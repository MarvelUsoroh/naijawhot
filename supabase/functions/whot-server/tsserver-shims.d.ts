// These shims are ONLY to keep VS Code/tsserver diagnostics usable for
// Supabase Edge Functions (Deno + import maps). The runtime uses Deno.

// Minimal Deno global typing for non-Deno TypeScript tooling.
declare const Deno: {
  env: { get(key: string): string | undefined };
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
};

declare module "hono" {
  export type Context = any;
  export class Hono {
    use: any;
    options: any;
    post: any;
    get: any;
    notFound: any;
    fetch: any;
  }
}

declare module "hono/cors" {
  export function cors(...args: any[]): any;
}

declare module "@supabase/supabase-js" {
  export type SupabaseClient = any;
  export function createClient(...args: any[]): any;
}
