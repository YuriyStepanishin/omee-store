let pending:Promise<void>=Promise.resolve();
export function trackCartSave(operation:Promise<void>){pending=operation;}
export async function waitForCartSave(){await pending;}
