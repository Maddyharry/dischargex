import { getServerSession } from "next-auth";
import { authOptions } from "./auth";
import { resolveEmailFromBearerToken } from "./api-token";
import { prisma } from "./prisma";
export async function automatorUser(req: Request) {
  const origin=req.headers.get("origin");
  if(origin && origin!==new URL(req.url).origin) return null;
  const hasBearer=req.headers.has("authorization");
  const email=hasBearer ? await resolveEmailFromBearerToken(req) : (await getServerSession(authOptions))?.user?.email;
  if(!email) return null;
  return prisma.user.findUnique({where:{email},select:{id:true,role:true}});
}
