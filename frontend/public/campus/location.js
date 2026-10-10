/* Browser location and north-referenced compass helpers. */
(function(root){
  'use strict';
  const R=6378137;
  function project(longitude,latitude,wkid=3857){
    if(!Number.isFinite(longitude)||!Number.isFinite(latitude)||Math.abs(latitude)>90||Math.abs(longitude)>180)throw new Error('Invalid location coordinates.');
    if(wkid===4326)return [longitude,latitude];
    if(![3857,102100,102113,900913].includes(wkid))throw new Error('Location needs a map in Web Mercator or latitude/longitude coordinates.');
    const lat=Math.max(-85.05112878,Math.min(85.05112878,latitude));
    return [R*longitude*Math.PI/180,R*Math.log(Math.tan(Math.PI/4+lat*Math.PI/360))];
  }
  function heading(event,screenAngle=0){
    let value=null;
    if(Number.isFinite(event.webkitCompassHeading) && (!Number.isFinite(event.webkitCompassAccuracy)||event.webkitCompassAccuracy>=0))value=event.webkitCompassHeading;
    else if(event.absolute===true && Number.isFinite(event.alpha))value=360-event.alpha;
    return value===null?null:((value+screenAngle)%360+360)%360;
  }
  function tracker({onPosition,onHeading,onStatus}){
    let active=false,watch=null,generation=0;
    const orient=event=>{
      if(!active)return;
      const value=heading(event,root.screen?.orientation?.angle ?? root.orientation ?? 0);
      if(value!==null)onHeading(value);
    };
    function stop(){
      active=false;generation++;
      if(watch!==null)root.navigator.geolocation.clearWatch(watch);
      watch=null;
      root.removeEventListener('deviceorientationabsolute',orient);
      root.removeEventListener('deviceorientation',orient);
    }
    async function start(){
      stop();
      if(!root.isSecureContext){onStatus('Location and compass access require HTTPS or localhost.');return false;}
      if(!root.navigator.geolocation){onStatus('Location is unavailable in this browser.');return false;}
      active=true;const request=++generation;
      // iOS requires this call directly inside the button's user gesture.
      let permission;
      try{permission=root.DeviceOrientationEvent?.requestPermission?.(true);}catch{permission=Promise.resolve('denied');}
      root.addEventListener('deviceorientationabsolute',orient);
      root.addEventListener('deviceorientation',orient);
      onStatus('Finding your location… Compass waiting for a sensor reading.');
      watch=root.navigator.geolocation.watchPosition(position=>{
        if(active && request===generation)onPosition(position);
      },error=>{
        if(!active || request!==generation)return;
        if(error.code===1)stop();
        onStatus(error.code===1?'Location permission denied. Allow location access in browser settings and try Locate again.':error.code===3?'Location timed out. Waiting for a new position…':'Location unavailable. Waiting for a new position…');
      },{enableHighAccuracy:true,maximumAge:5000,timeout:15000});
      if(permission){
        try{if(await permission!=='granted' && active && request===generation)onStatus('Compass permission denied. Your location can still be shown.');}
        catch{if(active && request===generation)onStatus('Compass unavailable. Your location can still be shown.');}
      }else if(!root.DeviceOrientationEvent)onStatus('Compass unavailable on this device. Your location can still be shown.');
      return active;
    }
    return {start,stop,get active(){return active;}};
  }
  const api={project,heading,tracker};
  if(typeof module!=='undefined')module.exports=api;else root.MapLocation=api;
})(globalThis);
