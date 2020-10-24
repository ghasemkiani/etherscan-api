//	@ghasemkiani/etherscan-api/client

const fetch = require("isomorphic-fetch");

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
	async toGetContractAbi(address) {
		let json = await this.toGet("contract", "getabi", {address});
		let abi = JSON.parse(json.result);
		return abi;
	}
}
cutil.extend(Client.prototype, {
	endpoint: "https://api.etherscan.io/api",
	apiKeyTokenEnvName: "ETHERSCAN_APIKEY_TOKEN",
	_apiKeyToken: null,
});

module.exports = {Client};

// https://api.etherscan.io/apis
