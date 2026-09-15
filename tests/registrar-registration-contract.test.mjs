import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../lib/domain/providers/resellerclub.js',import.meta.url),'utf8');
for(const country of ['GB','NG'])test(country+' partner contact and external-payment registration contract',async()=>{
const calls=[],m={exports:{}};const fakeFetch=async(url,options={})=>{const u=new URL(url),params=Object.fromEntries(new URLSearchParams(options.body||u.search));calls.push({path:u.pathname,params});const data=u.pathname.endsWith('/available.json')?{'sample-partner.com':{status:'available'}}:u.pathname.endsWith('/signup.json')?{customerid:'123456'}:u.pathname.endsWith('/add.json')?{contactid:'234567'}:u.pathname.endsWith('/register.json')?{entityid:'345678'}:null;if(!data)throw Error('Unexpected endpoint');return Response.json(data);};
vm.runInNewContext(source,{module:m,exports:m.exports,process:{env:{RESCLUB_AUTH_USERID:'123456',RESCLUB_API_KEY:'synthetic',RESCLUB_NS1:'ns1.example.com',RESCLUB_NS2:'ns2.example.com',RESCLUB_INVOICE_OPTION:'KeepInvoice'}},console:{info(){},warn(){},error(){}},fetch:fakeFetch,URL,URLSearchParams,AbortSignal});
const result=await m.exports.registerDomain({externallyPaid:true,domainName:'sample-partner.com',years:1,fullName:'Sample Owner',registrantCompany:'Partner Business Limited',email:'owner@example.invalid',registrantAddress1:'10 Sample Street',registrantCity:'Sample City',registrantState:'Sample State',registrantCountry:country,registrantPostalCode:'123456',registrantPhone:'7881194138',registrantPhoneCc:country==='GB'?'44':'234'});
assert.equal(result.success,true);for(const call of calls.filter(x=>/signup|add/.test(x.path))){assert.equal(call.params.company,'Partner Business Limited');assert.equal(call.params.country,country);}assert.equal(calls.find(x=>x.path.endsWith('/register.json')).params['invoice-option'],'NoInvoice');
});


test('own-account funds use parent USD, not misleading NGN label or GBP accounting value',async()=>{
 const m={exports:{}};vm.runInNewContext(source,{module:m,exports:m.exports,process:{env:{RESCLUB_AUTH_USERID:'123456',RESCLUB_API_KEY:'synthetic'}},console:{info(){},warn(){},error(){}},fetch:async url=>Response.json(new URL(url).pathname.includes('reseller-balance')?{sellingcurrencysymbol:'NGN',sellingcurrencybalance:20.41,accountingcurrencysymbol:'GBP',accountingcurrencybalance:0.01}:{parentsellingcurrencysymbol:'USD'}),URL,URLSearchParams,AbortSignal});
 const result=await m.exports.getPlatformFundingBalance();assert.equal(result.currency,'USD');assert.equal(result.amountMinor,2041);
});
