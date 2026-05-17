import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const isProduction = mode === 'production';
  const isStaging = mode === 'staging';
  
  return {
    plugins: [react()],
    define: {
      'process.env.NODE_ENV': JSON.stringify(isProduction ? 'production' : 'staging'),
      'process.env.IS_STAGING': JSON.stringify(isStaging),
      'process.env.IS_PRODUCTION': JSON.stringify(isProduction),
    },
  }
})
