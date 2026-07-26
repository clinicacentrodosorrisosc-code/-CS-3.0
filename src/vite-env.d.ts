// Manual declaration of Vite client types to fix "Cannot find type definition for vite/client" error
interface ImportMetaEnv {
  readonly [key: string]: string | boolean | undefined;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
