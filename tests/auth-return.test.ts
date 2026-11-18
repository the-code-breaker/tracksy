import{describe,it,expect}from'vitest';
import{returnAfterAuth}from'../apps/mobile/src/lib/auth-return';
describe('returning to an invitation after authentication',()=>{
 it('returns Google or email confirmation to the pending group invitation',()=>{const token='a'.repeat(64);expect(returnAfterAuth(false,token)).toEqual({pathname:'/join',params:{token}})});
 it('finishes password recovery before opening a pending invitation',()=>{expect(returnAfterAuth(true,'a'.repeat(64))).toBe('/auth/password')});
 it('does not navigate on malformed invitation input',()=>{expect(returnAfterAuth(false,'https://untrusted.example')).toBe('/');expect(returnAfterAuth(false)).toBe('/')});
});
