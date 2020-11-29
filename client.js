//	@ghasemkiani/etherscan-api/client

const fetch = require("isomorphic-fetch");
const Cache = require("async-disk-cache");

const {cutil} = require("@ghasemkiani/commonbase/cutil");
const {Base} = require("@ghasemkiani/commonbase/base");

class Client extends Base {
	get apiKeyToken() {
		if(!this._apiKeyToken) {
			if(this.apiKeyTokenEnvName) {
				this._apiKeyToken = process.env[this.apiKeyTokenEnvName];
			}
		}
		return this._apiKeyToken || "YourApiKeyToken";
	}
	set apiKeyToken(apiKeyToken) {
		this._apiKeyToken = apiKeyToken;
	}
	get cache() {
		if(!this._cache) {
			this._cache = new Cache(this.cacheName);
		}
		return this._cache;
	}
	set cache(cache) {
		this._cache = null;
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
	async toGetContractAbi(address) {
		let sabi = null;
		let saveCache = false;
		let key = address;
		if(this.useCache) {
			try {
				let cacheEntry = await this.cache.get(key);
				if(cacheEntry && cacheEntry.isCached && cacheEntry.value) {
					sabi = cacheEntry.value;
				} else {
					saveCache = true;
				}
			} catch(e) {}
		}
		if(!sabi) {
			let json = await this.toGet("contract", "getabi", {address});
			sabi = json.result;
			if(saveCache) {
				await this.cache.set(key, sabi);
			}
		}
		let abi = JSON.parse(sabi);
		return abi;
	}
}
cutil.extend(Client.prototype, {
	endpoint: "https://api.etherscan.io/api",
	apiKeyTokenEnvName: "ETHERSCAN_APIKEY_TOKEN",
	_apiKeyToken: null,
	useCache: true,
	cacheName: "etherscan",
	_cache: null,
});

module.exports = {Client};

// https://api.etherscan.io/apis
