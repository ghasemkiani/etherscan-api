//	@ghasemkiani/etherscan-api/client

import fetch from "isomorphic-fetch";
import Cache from "async-disk-cache";
import abiDecoder from "abi-decoder";

import {cutil} from "@ghasemkiani/base";
import {Obj} from "@ghasemkiani/base";

class Client extends Obj {
	get apiKeyToken() {
		if (!this._apiKeyToken) {
			if (this.apiKeyTokenEnvName) {
				this._apiKeyToken = process.env[this.apiKeyTokenEnvName];
			}
		}
		return this._apiKeyToken || "YourApiKeyToken";
	}
	set apiKeyToken(apiKeyToken) {
		this._apiKeyToken = apiKeyToken;
	}
	// singleton
	static _cache = null;
	get cache() {
		if (!this.constructor._cache) {
			this.constructor._cache = new Cache(this.cacheName);
		}
		return this.constructor._cache;
	}
	set cache(cache) {
		this.constructor._cache = null;
	}
	async toFetch(module, action, params) {
		params = Object(params);
		params.module = module;
		params.action = action;
		params.apikey = this.apiKeyToken;
		let query = Object.entries(params).map(bi => bi.map(s => encodeURIComponent(s)).join("=")).join("&");
		let url = `${this.endpoint}?${query}`;
		let rsp = await fetch(url);
		return rsp;
	}
	async toGet(module, action, params) {
		let rsp = await this.toFetch(module, action, params);
		let json = await rsp.json();
		return json;
	}
	async toListTransactions(address, startblock = 0, endblock = 999999999, sort = "desc") {
		let json = await this.toGet("account", "txlist", {address, startblock, endblock, sort});
		return json;
	}
	async toListInternalTransactions(address, startblock = 0, endblock = 999999999, sort = "desc") {
		let json = await this.toGet("account", "txlistinternal", {address, startblock, endblock, sort});
		return json;
	}
	get addedAbisMap() {
		if (!this._addedAbisMap) {
			this._addedAbisMap = {};
		}
		return this._addedAbisMap;
	}
	set addedAbisMap(addedAbisMap) {
		this._addedAbisMap = addedAbisMap;
	}
	addAbi(abi, address) {
		abiDecoder.addABI(abi);
		if (address) {
			this.addedAbisMap[address] = true;
		}
	}
	async toDecodeTx(tx) {
		let {input} = tx;
		if (input !== "0x") {
			try {
				let {to: address} = tx;
				if (!this.addedAbisMap[address]) {
					let abi = await this.toGetContractAbi(address);
					abiDecoder.addABI(abi);
					this.addedAbisMap[address] = true;
				}
				tx.decodedData = abiDecoder.decodeMethod(tx.input);
				if (tx.decodedData) {
					let params = tx.decodedData.params;
					tx.decodedData.paramsObj = params.reduce(((obj, {name, value}) => ((obj[name] = value), obj)), {});
				}
			} catch(e) {
				if (this.logErrors) {
					console.log(`${e.message}\n${JSON.stringify(tx)}`);
				}
			}
		}
		return tx;
	}
	async toListTxs(arg) {
		arg = Object.assign({
			address: null,
			startblock: 0,
			endblock: 999999999,
			sort: "desc",
			decode: true,
			toProcessTx: null,
			logErrors: false,
		}, arg);
		let {address, startblock, endblock, sort, decode, toProcessTx, logErrors} = arg;
		let {status, message, result: txs} = await this.toListTransactions(address, startblock, endblock, sort);
		if (!status) {
			throw new Error(message);
		}
		if (decode) {
			for (let tx of txs) {
				tx = await this.toDecodeTx(tx);
				if (toProcessTx) {
					await toProcessTx(tx);
				}
			}
		}
		return txs;
	}
	getCacheKey(address) {
		return cutil.asString(address).toLowerCase();
	}
	async toGetContractAbi(address, logError = false) {
		let sabi = null;
		let saveCache = false;
		let key = this.getCacheKey(address);
		if (this.useCache) {
			try {
				let cacheEntry = await this.cache.get(key);
				if (cacheEntry && cacheEntry.isCached && cacheEntry.value) {
					sabi = cacheEntry.value;
				} else {
					saveCache = true;
				}
			} catch(e) {}
		}
		if (!sabi) {
			let json = await this.toGet("contract", "getabi", {address});
			sabi = json.result;
		}
		let abi;
		try {
			abi = JSON.parse(sabi);
		} catch(e) {
			if (logError) {
				console.log(`Error in retrieving abi for address: ${address}`);
				console.log(sabi);
			}
			throw e;
		}
		if (saveCache) {
			await this.cache.set(key, sabi);
		}
		return abi;
	}
	async toSaveContractAbiToCache(address, sabi) {
		let key = this.getCacheKey(address);
		await this.cache.set(key, sabi);
	}
	async toRemoveContractAbiFromCache(address) {
		let result = false;
		let key = this.getCacheKey(address);
		try {
			await this.cache.remove(key);
			result = true;
		} catch(e) {}
		return result;
	}
}
cutil.extend(Client.prototype, {
	endpoint: "https://api.etherscan.io/api",
	apiKeyTokenEnvName: "ETHERSCAN_APIKEY_TOKEN",
	_apiKeyToken: null,
	useCache: true,
	cacheName: "etherscan",
	// _cache: null,
	_addedAbisMap: null,
	logErrors: true,
});

export {Client};

// https://api.etherscan.io/apis
