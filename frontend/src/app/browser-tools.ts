interface ModelContext {registerTool(tool:{name:string;description:string;inputSchema:object;annotations:object;execute:(input:unknown)=>unknown},options:{signal:AbortSignal}):void|Promise<void>;}
export function registerPublicReadTool(read:()=>unknown,signal:AbortSignal,context?:ModelContext):void {
  if(!context?.registerTool)return;
  try{void Promise.resolve(context.registerTool({name:'read_health_habits',description:'Read the public habit entries and totals for the currently loaded week.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:false},execute:(input:unknown)=>{if(input!==undefined&&(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).length))throw new Error('This tool accepts an empty object.');return read();}},{signal})).catch(()=>{});}catch{/* Unsupported browsers keep the normal page experience. */}
}
export function browserModelContext():ModelContext|undefined{return (document as Document&{modelContext?:ModelContext}).modelContext;}
