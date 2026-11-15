const unavailable=new Set(['ECONNREFUSED','ECONNRESET','ETIMEDOUT','ENETUNREACH','EHOSTUNREACH','ENOTFOUND','EAI_AGAIN','EPIPE','53300','57P01','57P02','57P03','08000','08001','08003','08004','08006','08007','08P01']);
export function databaseUnavailable(error){
  if(unavailable.has(error.code))return error.code;
  if(/timeout exceeded when trying to connect|connection terminated due to connection timeout|connection terminated unexpectedly/i.test(error.message||''))return 'CONNECTION_TIMEOUT';
  return null;
}
