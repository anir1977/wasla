import test from 'node:test';
import assert from 'node:assert/strict';
import {signWebhook,verifyWebhook} from '../src/lib/signature';
import {normalizePhone,productInput,extractionSchema} from '../src/lib/validation';
import {validatePurchase} from '../src/lib/ai/decision';
import {demoProducts} from '../src/lib/demo';
const secret='a'.repeat(64),stamp=String(Date.now()),body=JSON.stringify({storeId:'shop-a',text:'salam'});
test('webhook authentication rejects tampering, expiration and missing credentials',()=>{
 const sig='sha256='+signWebhook(body,stamp,secret);
 assert.equal(verifyWebhook(body,stamp,sig,secret),true);
 assert.equal(verifyWebhook(body+' ',stamp,sig,secret),false);
 assert.equal(verifyWebhook(body,String(Number(stamp)-600000),sig,secret),false);
 assert.equal(verifyWebhook(body,stamp,sig,''),false);
 assert.equal(verifyWebhook(body,stamp,'sha256=wrong',secret),false);
});
test('Moroccan phone normalization and validation',()=>{
 for(const value of ['0708025467','+212708025467','00212708025467'])assert.equal(normalizePhone(value),'+212708025467');
 assert.throws(()=>normalizePhone('212+bad'));
});
test('product input rejects negative stock, duplicates and negative prices',()=>{
 const base={name:'T-shirt',description:'',price_mad:149,active:true,variants:[{size:'M',color:'Noir',stock:2}]};
 assert.equal(productInput.safeParse(base).success,true);
 assert.equal(productInput.safeParse({...base,price_mad:-1}).success,false);
 assert.equal(productInput.safeParse({...base,variants:[...base.variants,...base.variants]}).success,false);
 assert.equal(productInput.safeParse({...base,variants:[{size:'M',color:'Noir',stock:-1}]}).success,false);
});
test('AI purchase gate requires confirmation, complete fields, real variant and available stock',()=>{
 const output=extractionSchema.parse({reply:'OK',intent:'CONFIRM_PURCHASE',explicit_confirmation:true,customer_name:'Salma',city:'Casa',address:'10 rue Demo',variant_id:demoProducts[0].variants[0].id,quantity:1});
 assert.ok(validatePurchase(output,demoProducts,'oui je confirme'));
 assert.ok(validatePurchase(output,demoProducts,'ah safi siftouha'));
 assert.ok(validatePurchase(output,demoProducts,'wakha'));
 assert.ok(validatePurchase(output,demoProducts,'safi twakkelna 3la lah'));
 assert.ok(validatePurchase(output,demoProducts,'نعم صيفطوها'));
 assert.ok(validatePurchase(output,demoProducts,'توكلنا على الله'));
 assert.equal(validatePurchase(output,demoProducts,'est-ce disponible ?'),null);
 assert.equal(validatePurchase(output,demoProducts,'ma bghitch'),null);
 assert.equal(validatePurchase(output,demoProducts,'la choukran'),null);
 assert.equal(validatePurchase({...output,address:null},demoProducts,'oui'),null);
 assert.equal(validatePurchase({...output,variant_id:'fabricated'},demoProducts,'oui'),null);
 assert.equal(validatePurchase({...output,quantity:20},demoProducts,'oui'),null);
 assert.equal(validatePurchase({...output,explicit_confirmation:false},demoProducts,'oui'),null);
});
