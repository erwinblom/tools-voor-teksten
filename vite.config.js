import {defineConfig} from 'vite';
import {redactCompressedCore} from './scripts/redact-compressed.mjs';
export default defineConfig({base:'./',publicDir:process.env.VITE_REMOTE_MODELS === 'true'?'public-web':'public',plugins:[redactCompressedCore()],build:{target:'esnext'},optimizeDeps:{exclude:['@desert-ant-labs/redact','@desert-ant-labs/core']}});
