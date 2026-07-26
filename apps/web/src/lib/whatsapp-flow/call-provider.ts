export interface CallProvider{createCall(input:{to:string;scheduledAtUtc:string;submissionId:string;context:Record<string,unknown>}):Promise<{providerReference:string;status:"queued"|"started"}>}
class UnconfiguredCallProvider implements CallProvider{async createCall():Promise<never>{throw new Error("call_provider_not_configured")}}
export function getCallProvider():CallProvider{const name=process.env.CALL_PROVIDER?.trim();if(!name||name==="none"||name==="manual")return new UnconfiguredCallProvider();throw new Error(`unsupported_call_provider:${name}`)}
