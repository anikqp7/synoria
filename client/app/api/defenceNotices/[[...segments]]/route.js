import { getToken } from 'next-auth/jwt';
import { NextResponse } from 'next/server';
import { forwardRoleRequest } from '@/lib/backendApi';
async function handler(request,{params}){
 const token=await getToken({req:request});if(!token?.backendCookie)return NextResponse.json({message:'Please sign in again.'},{status:401});
 const role=token.department?.role||'department';if(!['department','student','supervisor','examiner'].includes(role))return NextResponse.json({message:'This account cannot access defence notices.'},{status:403});
 if(request.method!=='GET'&&role!=='department')return NextResponse.json({message:'Only your department can manage defence notices.'},{status:403});
 const{segments=[]}=await params;
 if(['GET','POST'].includes(request.method)?segments.length!==0:segments.length!==1||!/^[a-f0-9]{24}$/i.test(segments[0]))return NextResponse.json({message:'Defence notice not found.'},{status:404});
 return forwardRoleRequest(request,`defenceNotices${segments.length?`/${segments[0]}`:''}`,role);
}
export{handler as GET,handler as POST,handler as PATCH,handler as DELETE};
