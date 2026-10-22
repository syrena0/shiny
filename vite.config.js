import {defineConfig} from 'vite';
import {fileURLToPath,URL} from 'node:url';
import tailwindcss from '@tailwindcss/vite';
export default defineConfig({
 resolve:{alias:{'@':fileURLToPath(new URL('./src',import.meta.url))}},
 plugins:[tailwindcss()],
 esbuild:{jsx:'automatic'},
 build:{rollupOptions:{
  // This is a browser-only Vite app; dependency RSC directives have no runtime meaning.
  onwarn(warning,warn){
   if(warning.code==='MODULE_LEVEL_DIRECTIVE'&&warning.message.includes('use client'))return;
   warn(warning);
  },
  output:{manualChunks(id){if(id.includes('node_modules'))return 'vendor';}}
 }}
});
