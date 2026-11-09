const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm'),fs=require('node:fs');
function harness(){
 const devices=['N2','CO2','CH4'].map((type,i)=>({id:41+i,sensor_id:11+i,sensor_type:type,gpio_pin:[18,19,21][i],status:'normal',is_blinking:false,async update(v){Object.assign(this,v);}}));
 const history=[],rows=[],events=[],published=[];
 const deps={
 '../config/database':{transaction:async fn=>fn({LOCK:{UPDATE:'UPDATE'}})},
 '../models/alert-device.model':{findAll:async()=>devices,findOne:async q=>devices.find(d=>d.sensor_type===q.where.sensor_type)},
 '../models/alert-history.model':{create:async v=>history.push({...v}),update:async(v,q)=>history.filter(r=>r.alert_device_id===q.where.alert_device_id&&r.status===q.where.status).forEach(r=>Object.assign(r,v)),count:async q=>history.filter(r=>r.alert_device_id===q.where.alert_device_id).length},
 '../models/sensor-data.model':{create:async v=>{const r={...v,id:rows.length+1};rows.push(r);return {toJSON:()=>r}},findAll:async q=>rows.filter(r=>r.sensor_id===q.where.sensor_id).slice(-10).reverse()},
 '../config/socket':{getIO:()=>({emit:(name,data)=>events.push({name,data})})}
 };
 function load(){
 const mqttSource=fs.readFileSync('config/mqtt.js','utf8');
 const mqttLogic=mqttSource.slice(mqttSource.indexOf('const valid'),mqttSource.indexOf('let queue'));
 const controllerSource=fs.readFileSync('controllers/alert.controller.js','utf8');
 const controllerLogic=controllerSource.slice(controllerSource.indexOf('async function snapshot'),controllerSource.indexOf('module.exports.getDashboard'));
 const context={require:n=>deps[n],module:{exports:{}},console};
 const source=fs.readFileSync('config/alert.js','utf8')+
 '\nconst db=require("../config/database");const AlertDevice=require("../models/alert-device.model");const Device=AlertDevice;const History=require("../models/alert-history.model");const SensorData=require("../models/sensor-data.model");const {getIO}=require("../config/socket");\n'+mqttLogic+'\n'+controllerLogic+'\nmodule.exports={snapshot,sync,processPacket};';
 vm.runInNewContext(source,context);return context.module.exports;
 }

 return {service:load(),load,devices,history,rows,events,published,client:{publish:(topic,payload,opts,cb)=>{published.push({topic,payload,opts});cb()}}};
}
test('each gas: boundary, continuous alert, recovery, second episode',async()=>{
 for(const [key,threshold] of Object.entries({n2:80,co2:1000,ch4:500})){
 const h=harness();for(const value of [threshold,threshold+1,threshold+2,threshold+1,threshold,threshold+1])await h.service.processPacket({[key]:value},h.client);
 assert.equal(h.history.length,2);assert.equal(h.history[0].status,'resolved');assert.ok(h.history[0].ended_at);assert.equal(h.history[1].status,'active');assert.equal(h.published.length,6);assert.equal(h.events.at(-1).data.totalAlerts,2);
 }
});
test('simultaneous gases, invalid values do not resolve, reload/restart preserves counts',async()=>{
 const h=harness();await h.service.processPacket({n2:82,co2:1100,ch4:600},h.client);
 await h.service.processPacket({n2:null,co2:'0',ch4:NaN},h.client);
 assert.equal(h.history.length,3);assert.equal(h.events.length,3);
 const restarted=h.load();await restarted.processPacket({n2:83,co2:1200,ch4:700},h.client);
 assert.equal(h.history.length,3);
 for(let i=0;i<3;i++){const state=await restarted.snapshot();assert.equal(state.length,3);state.forEach(d=>{assert.equal(d.totalAlerts,1);assert.equal(d.status,'alert')});}
 assert.equal(h.history.length,3);
});
test('reconnect publishes DB IDs and retained state, including OFF',async()=>{
 const h=harness();await h.service.processPacket({co2:1100},h.client);h.published.length=0;
 await h.service.sync(h.client);
 assert.equal(h.published[0].topic,'alert/config');assert.equal(JSON.parse(h.published[0].payload)[0].id,41);
 assert.deepEqual(h.published.slice(1).map(p=>[p.topic,p.payload]),[['alert/41/blink','0'],['alert/42/blink','1'],['alert/43/blink','0']]);
 h.published.forEach(p=>assert.equal(p.opts.retain,true));
});
