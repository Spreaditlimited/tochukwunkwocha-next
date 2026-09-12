import { verifyDomainPlatformRequest } from '@/lib/domain/platform-auth';
import { platformCommand, platformDomainCommand } from '@/lib/domain/platform-orders';
import { renewalCommand,platformRenewalCommand } from '@/lib/domain/platform-renewals';
export const dynamic='force-dynamic';
export const maxDuration=120;
export async function POST(request:Request){
 const reader=request.body?.getReader();if(!reader)return Response.json({message:'Request body required.'},{status:400});let size=0;const chunks:Uint8Array[]=[];
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>8192){await reader.cancel();return Response.json({message:'Request too large.'},{status:413});}chunks.push(value);}
 const body=Buffer.concat(chunks).toString('utf8');
 try{await verifyDomainPlatformRequest(request,body);}catch{return Response.json({message:'Platform authentication failed.'},{status:401});}
 let value:unknown;try{value=JSON.parse(body);}catch{return Response.json({message:'Invalid JSON.'},{status:400});}
 const renewal=renewalCommand.safeParse(value);
 if(renewal.success){try{return Response.json(await platformRenewalCommand(renewal.data),{headers:{'Cache-Control':'no-store'}});}catch(error){return Response.json({message:error instanceof Error?error.message:'Renewal unavailable.'},{status:409,headers:{'Cache-Control':'no-store'}});}}
 const parsed=platformCommand.safeParse(value);
 if(!parsed.success)return Response.json({message:'Invalid domain operation.'},{status:422});
 try{return Response.json(await platformDomainCommand(parsed.data),{headers:{'Cache-Control':'no-store'}});}catch(error){return Response.json({message:error instanceof Error?error.message:'Domain operation failed.'},{status:409,headers:{'Cache-Control':'no-store'}});}
}
