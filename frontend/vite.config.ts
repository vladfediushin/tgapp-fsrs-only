import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// Plugin to exclude development files from production builds
const excludeDevFilesPlugin = () => {
  return {
    name: 'exclude-dev-files',
    resolveId(id: string) {
      // Exclude utils/dev/* files in production builds
      if (process.env.NODE_ENV === 'production' && id.includes('utils/dev/')) {
        return { id, external: true }
      }
      return null
    }
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    excludeDevFilesPlugin()
  ],
  
  // Production build optimization
  build: {
    // Target modern browsers for better optimization
    target: 'es2022',
    
    // Enable minification with terser for better compression
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true, // Remove console.logs in production
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info', 'console.debug', 'console.warn'],
        passes: 3, // More passes for better compression
        unsafe: true, // Enable unsafe optimizations
        unsafe_comps: true,
        unsafe_Function: true,
        unsafe_math: true,
        unsafe_symbols: true,
        unsafe_methods: true,
        unsafe_proto: true,
        unsafe_regexp: true,
        unsafe_undefined: true,
        dead_code: true,
        evaluate: true,
        hoist_funs: true,
        hoist_props: true,
        hoist_vars: true,
        if_return: true,
        join_vars: true,
        loops: true,
        negate_iife: true,
        properties: true,
        reduce_funcs: true,
        reduce_vars: true,
        side_effects: true,
        switches: true,
        toplevel: true,
        typeofs: true,
        unused: true,
      },
      mangle: {
        safari10: true, // Fix Safari 10 issues
        toplevel: true,
        properties: {
          regex: /^_/
        }
      },
      format: {
        comments: false, // Remove comments
      },
    },
    
    // Chunk size warning limit (100KB for better performance)
    chunkSizeWarningLimit: 100,
    
    // Advanced chunking strategy for optimal loading and tree shaking
    rollupOptions: {
      output: {
        // Optimized manual chunking for better tree shaking
        manualChunks: (id) => {
          // Vendor chunks - split by usage pattern
          if (id.includes('node_modules')) {
            // React ecosystem - critical
            if (id.includes('react') || id.includes('react-dom')) {
              return 'react-core'
            }
            
            // Router - navigation critical
            if (id.includes('react-router')) {
              return 'react-router'
            }
            
            // State management - early load
            if (id.includes('zustand')) {
              return 'state-management'
            }
            
            // API utilities - medium priority
            if (id.includes('axios') || id.includes('zod')) {
              return 'vendor-api'
            }
            
            // UI libraries - lazy load
            if (id.includes('lucide-react') || id.includes('react-icons')) {
              return 'vendor-ui'
            }
            
            // Charts - lazy load only when needed
            if (id.includes('recharts') || id.includes('react-circular-progressbar')) {
              return 'vendor-charts'
            }
            
            // Date utilities - lazy load
            if (id.includes('date-fns') || id.includes('react-datepicker')) {
              return 'vendor-date'
            }
            
            // i18n - lazy load
            if (id.includes('i18next') || id.includes('react-i18next')) {
              return 'vendor-i18n'
            }
            
            // Other vendors
            return 'vendor-misc'
          }
          
          // App chunks - split by feature and usage
          if (id.includes('/src/')) {
            // Utils - split by category for better tree shaking
            if (id.includes('/utils/core/')) {
              return 'utils-core'
            }
            if (id.includes('/utils/dev/')) {
              return 'utils-dev' // Should be excluded in production
            }
            if (id.includes('/utils/optimization/')) {
              return 'utils-optimization'
            }
            if (id.includes('/utils/features/')) {
              return 'utils-features'
            }
            if (id.includes('/utils/ui/')) {
              return 'utils-ui'
            }
            if (id.includes('/utils/')) {
              return 'utils-misc'
            }
            
            // Store - split by functionality
            if (id.includes('/store/')) {
              if (id.includes('unified.ts') || id.includes('session.ts')) {
                return 'store-core'
              }
              if (id.includes('offlineQueue.ts') || id.includes('offlineSystem')) {
                return 'store-offline'
              }
              if (id.includes('fsrs.ts') || id.includes('stats.ts')) {
                return 'store-features'
              }
              return 'store-misc'
            }
            
            // Components - split by usage pattern
            if (id.includes('/components/')) {
              if (id.includes('ErrorBoundary') || id.includes('PageLoader')) {
                return 'components-core'
              }
              if (id.includes('statistics/') || id.includes('fsrs/')) {
                return 'components-features'
              }
              return 'components-ui'
            }
            
            // Pages - each page as separate chunk for route-based splitting
            if (id.includes('/pages/')) {
              if (id.includes('Home')) return 'page-home'
              if (id.includes('Settings')) return 'page-settings'
              if (id.includes('Statistics')) return 'page-statistics'
              if (id.includes('Repeat')) return 'page-repeat'
              if (id.includes('Profile')) return 'page-profile'
              if (id.includes('Topics')) return 'page-topics'
              if (id.includes('Results')) return 'page-results'
              if (id.includes('Authorize')) return 'page-authorize'
              if (id.includes('ModeSelect')) return 'page-mode'
              if (id.includes('ExamSettings')) return 'page-exam'
              if (id.includes('FSRS')) return 'page-fsrs'
              return 'page-misc'
            }
            
            // API
            if (id.includes('/api/')) {
              return 'api'
            }
          }
          
          return undefined
        },
        
        // Optimize chunk naming for caching
        chunkFileNames: (chunkInfo) => {
          const facadeModuleId = chunkInfo.facadeModuleId
          if (facadeModuleId) {
            const name = facadeModuleId.split('/').pop()?.replace('.tsx', '').replace('.ts', '')
            return `assets/[name]-[hash].js`
          }
          return 'assets/[name]-[hash].js'
        },
        
        // Optimize asset naming
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name?.split('.') || []
          const ext = info[info.length - 1]
          
          if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(ext || '')) {
            return `assets/images/[name]-[hash][extname]`
          }
          if (/css/i.test(ext || '')) {
            return `assets/css/[name]-[hash][extname]`
          }
          return `assets/[name]-[hash][extname]`
        },
      },
      
      // Tree shaking configuration
      treeshake: {
        moduleSideEffects: false,
        propertyReadSideEffects: false,
        tryCatchDeoptimization: false,
        unknownGlobalSideEffects: false,
      },
      
      // External dependencies (exclude dev utilities in production)
      external: (id) => {
        if (process.env.NODE_ENV === 'production' && id.includes('utils/dev/')) {
          return true
        }
        return false
      },
    },
    
    // Source maps for production debugging (lightweight)
    sourcemap: process.env.NODE_ENV === 'development' ? true : 'hidden',
    
    // Output directory
    outDir: 'dist',
    
    // Clean output directory before build
    emptyOutDir: true,
    
    // Asset inlining threshold (2KB for better optimization)
    assetsInlineLimit: 2048,
    
    // CSS code splitting enabled
    cssCodeSplit: true,
    
    // CSS minification
    cssMinify: true,
    
    // Report compressed size
    reportCompressedSize: true,
    
    // Write bundle info for analysis
    write: true,
  },
  
  // Development server configuration
  server: {
    port: 5173,
    host: true,
    cors: true,
  },
  
  // Preview server configuration
  preview: {
    port: 4173,
    host: true,
  },
  
  // Path resolution
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@components': resolve(__dirname, 'src/components'),
      '@pages': resolve(__dirname, 'src/pages'),
      '@utils': resolve(__dirname, 'src/utils'),
      '@store': resolve(__dirname, 'src/store'),
      '@api': resolve(__dirname, 'src/api'),
      '@types': resolve(__dirname, 'src/types'),
      '@styles': resolve(__dirname, 'src/styles'),
    },
  },
  
  // Environment variables
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  
  // Optimization for production
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'zustand',
      'axios',
    ],
    exclude: [
      // Exclude large libraries that should be lazy loaded
      'recharts',
      'react-datepicker',
    ],
  },
  
  // CSS preprocessing
  css: {
    devSourcemap: true,
    preprocessorOptions: {
      scss: {
        additionalData: `@import "@/styles/variables.scss";`,
      },
    },
  },
  
  // Asset processing
  assetsInclude: ['**/*.woff', '**/*.woff2', '**/*.ttf'],
})