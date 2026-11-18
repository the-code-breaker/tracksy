import shell from '../../app-shell';
export function GET(request:Request){const path=new URL(request.url).pathname;if(path.startsWith('/_expo/')||path.startsWith('/assets/')||path.startsWith('/icons/'))return new Response('Not found',{status:404});return new Response(shell,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'no-referrer'}})}
