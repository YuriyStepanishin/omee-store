export function waitForResponse(handler,req,res) {
  if(res.writableEnded||res.destroyed)return Promise.resolve();
  return new Promise((resolve,reject)=>{
    const cleanup=()=>{res.off('finish',done);res.off('close',done);res.off('error',fail);};
    const done=()=>{cleanup();resolve();};
    const fail=error=>{cleanup();reject(error);};
    res.once('finish',done);
    res.once('close',done);
    res.once('error',fail);
    try{Promise.resolve(handler(req,res)).catch(fail);}catch(error){fail(error);}
  });
}
