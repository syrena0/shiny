import {defineConfig} from '@playwright/test';
const production=process.env.TEST_PRODUCTION==='1';
const port=production?4173:5173;
export default defineConfig({
 testDir:'./tests',fullyParallel:false,
 use:{baseURL:`http://127.0.0.1:${port}`,headless:true,launchOptions:process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}},
 webServer:{command:`npm run ${production?'preview':'dev'} -- --port ${port}`,url:`http://127.0.0.1:${port}`,reuseExistingServer:true},
 reporter:'list'
});
