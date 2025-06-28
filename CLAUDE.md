# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an Expo-based inventory management application (PWA) built with React Native, TypeScript, Redux Toolkit, and Supabase. The app manages items, categories, and containers with features including barcode/QR code scanning, image handling, and comprehensive CRUD operations.

## Available Commands

### Development
- `expo start` - Start the development server
- `expo run:android` - Run on Android
- `expo run:ios` - Run on iOS  
- `expo start --web --clear` - Run web version with cleared cache
- `expo start --web --https` - Run web version with HTTPS

### Building
- `npm run build:web` - Build for web deployment
- `npm run build:cloudflare` - Build optimized for Cloudflare Pages

### Testing & Deployment
- `npm run test-pwa` - Test PWA permissions and functionality
- `npm run test-mobile-images` - Test mobile image handling
- `npm run deploy:expo` - Deploy to Expo (patch version)
- `npm run deploy:cloudflare` - Deploy to Cloudflare Pages (patch version)
- `npm run deploy:both` - Deploy to both platforms with mobile testing

### Version Management
- `npm run sync-version` - Synchronize version across app.json and package.json

## Architecture Overview

### State Management
- **Redux Toolkit** for all main entities (items, categories, containers)
- **Context API** for authentication and theming
- **Entity adapters** with normalized state structure
- **Async thunks** for all database operations

### Key Architectural Patterns

#### Redux Architecture (CRITICAL)
- **NEVER use React Query** - application is migrated to pure Redux
- **Always use Redux thunks** for data operations
- Use optimized hooks: `useStockPageData()`, `useCategoriesOptimized()`, `useContainersOptimized()`
- All mutations must go through Redux thunks (createItem, updateItem, etc.)

#### Database Access Rules
- **NO direct database imports** in components
- Access data only through Redux hooks and thunks
- Data flows: Database → Redux Thunks → Redux Store → Optimized Hooks → Components

#### Performance Optimizations
- **StyleFactory** for cached, themed styles
- **VirtualizedItemList** for lists with >50 items
- **Memoized selectors** in Redux store
- **Optimized hooks** that combine multiple selectors

### Database Schema
- **Items**: Core inventory entities with purchase/selling prices, status, QR codes
- **Categories**: Organizational categories with icons
- **Containers**: Physical storage containers with numbers
- **Data Access**: All users see all data (no user_id filtering on reads)
- **Naming**: snake_case in DB, camelCase in TypeScript with automatic conversion

### Navigation Structure
```
app/
├── (auth)/          # Authentication screens
├── (tabs)/          # Main tabbed interface (stock, add, scan)
├── (stack)/         # Modal-style screens (settings, stats)
├── item/[id]/       # Item detail pages (info, edit)
├── category/[id]/   # Category management
└── container/[id]/  # Container management
```

### Technology Stack
- **Expo SDK 53** with Expo Router for navigation
- **Supabase** for backend (auth, database, storage)
- **TypeScript** with strict type checking
- **React Native Paper** for UI components
- **Sentry** for error tracking
- **Cloudflare R2** for image storage

## Important Conventions

### Redux Patterns
```typescript
// ✅ CORRECT - Use optimized hooks
import { useStockPageData } from '../hooks/useOptimizedSelectors';
const { items, categories, containers, isLoading } = useStockPageData(filters);

// ✅ CORRECT - Use typed dispatch
import { useDispatch } from 'react-redux';
import { AppDispatch } from '../store/store';
const dispatch = useDispatch<AppDispatch>();
await dispatch(createItem(itemData)).unwrap();

// ❌ AVOID - Direct database access in components
import { database } from '../database/database';
```

### Styling with StyleFactory
```typescript
// ✅ CORRECT - Use StyleFactory for cached styles
import StyleFactory from '../styles/StyleFactory';
const { activeTheme } = useAppTheme();
const styles = StyleFactory.getThemedStyles(activeTheme, 'ItemCard');

// ❌ AVOID - StyleSheet.create in components (recreated on each render)
```

### Performance Patterns
```typescript
// ✅ CORRECT - Virtualized lists for large datasets
<VirtualizedItemList items={items} estimatedItemSize={120} />

// ✅ CORRECT - Memoized callbacks
const handleItemPress = useCallback((item) => {
  router.push(`/item/${item.id}/info`);
}, [router]);
```

### Data Transformation
- Database uses snake_case (purchase_price, container_id)
- TypeScript interfaces use camelCase (purchasePrice, containerId)
- Automatic conversion happens in database layer and thunks

## Key Files Reference

### Redux Store
- `src/store/store.ts` - Main store configuration
- `src/store/itemsThunks.ts` - Item operations
- `src/store/categoriesThunks.ts` - Category operations
- `src/store/containersThunks.ts` - Container operations
- `src/store/selectors.ts` - Memoized selectors

### Optimized Hooks
- `src/hooks/useOptimizedSelectors.ts` - Combined data hooks
- `src/hooks/useCategoriesOptimized.ts` - Category operations
- `src/hooks/useContainersOptimized.ts` - Container operations

### Core Components
- `src/components/VirtualizedItemList.tsx` - Performance-optimized item lists
- `src/components/Scanner.tsx` - QR/barcode scanning
- `src/styles/StyleFactory.ts` - Cached style management

### Configuration
- `src/config/supabase.tsx` - Database client setup
- `app.json` - Expo configuration
- `eas.json` - Build configuration
- `.cursor/rules/supabase-schema.mdc` - Database schema documentation

## Development Guidelines

### Performance Requirements
- Use VirtualizedItemList for any list with >50 items
- Always use StyleFactory instead of StyleSheet.create
- Implement proper memoization with useCallback/useMemo
- Use optimized Redux hooks to minimize re-renders

### Code Quality
- Follow Redux architecture patterns strictly
- Maintain TypeScript strict mode compliance
- Use error boundaries for component error handling
- Implement proper loading states and error handling


 # Using Gemini CLI for Large Codebase Analysis

  When analyzing large codebases or multiple files that might exceed context limits, use the Gemini CLI with its massive
  context window. Use `gemini -p` to leverage Google Gemini's large context capacity.

  ## File and Directory Inclusion Syntax

  Use the `@` syntax to include files and directories in your Gemini prompts. The paths should be relative to WHERE you run the
   gemini command:

  ### Examples:

  **Single file analysis:**
  ```bash
  gemini -p "@src/main.py Explain this file's purpose and structure"

  Multiple files:
  gemini -p "@package.json @src/index.js Analyze the dependencies used in the code"

  Entire directory:
  gemini -p "@src/ Summarize the architecture of this codebase"

  Multiple directories:
  gemini -p "@src/ @tests/ Analyze test coverage for the source code"

  Current directory and subdirectories:
  gemini -p "@./ Give me an overview of this entire project"
  
#
 Or use --all_files flag:
  gemini --all_files -p "Analyze the project structure and dependencies"

  Implementation Verification Examples

  Check if a feature is implemented:
  gemini -p "@src/ @lib/ Has dark mode been implemented in this codebase? Show me the relevant files and functions"

  Verify authentication implementation:
  gemini -p "@src/ @middleware/ Is JWT authentication implemented? List all auth-related endpoints and middleware"

  Check for specific patterns:
  gemini -p "@src/ Are there any React hooks that handle WebSocket connections? List them with file paths"

  Verify error handling:
  gemini -p "@src/ @api/ Is proper error handling implemented for all API endpoints? Show examples of try-catch blocks"

  Check for rate limiting:
  gemini -p "@backend/ @middleware/ Is rate limiting implemented for the API? Show the implementation details"

  Verify caching strategy:
  gemini -p "@src/ @lib/ @services/ Is Redis caching implemented? List all cache-related functions and their usage"

  Check for specific security measures:
  gemini -p "@src/ @api/ Are SQL injection protections implemented? Show how user inputs are sanitized"

  Verify test coverage for features:
  gemini -p "@src/payment/ @tests/ Is the payment processing module fully tested? List all test cases"

  When to Use Gemini CLI

  Use gemini -p when:
  - Analyzing entire codebases or large directories
  - Comparing multiple large files
  - Need to understand project-wide patterns or architecture
  - Current context window is insufficient for the task
  - Working with files totaling more than 100KB
  - Verifying if specific features, patterns, or security measures are implemented
  - Checking for the presence of certain coding patterns across the entire codebase

  Important Notes

  - Paths in @ syntax are relative to your current working directory when invoking gemini
  - The CLI will include file contents directly in the context
  - No need for --yolo flag for read-only analysis
  - Gemini's context window can handle entire codebases that would overflow Claude's context
  - When checking implementations, be specific about what you're looking for to get accurate results # Using Gemini CLI for Large Codebase Analysis


  When analyzing large codebases or multiple files that might exceed context limits, use the Gemini CLI with its massive
  context window. Use `gemini -p` to leverage Google Gemini's large context capacity.


  ## File and Directory Inclusion Syntax


  Use the `@` syntax to include files and directories in your Gemini prompts. The paths should be relative to WHERE you run the
   gemini command:


  ### Examples:


  **Single file analysis:**
  ```bash
  gemini -p "@src/main.py Explain this file's purpose and structure"


  Multiple files:
  gemini -p "@package.json @src/index.js Analyze the dependencies used in the code"


  Entire directory:
  gemini -p "@src/ Summarize the architecture of this codebase"


  Multiple directories:
  gemini -p "@src/ @tests/ Analyze test coverage for the source code"


  Current directory and subdirectories:
  gemini -p "@./ Give me an overview of this entire project"
  # Or use --all_files flag:
  gemini --all_files -p "Analyze the project structure and dependencies"


  Implementation Verification Examples


  Check if a feature is implemented:
  gemini -p "@src/ @lib/ Has dark mode been implemented in this codebase? Show me the relevant files and functions"


  Verify authentication implementation:
  gemini -p "@src/ @middleware/ Is JWT authentication implemented? List all auth-related endpoints and middleware"


  Check for specific patterns:
  gemini -p "@src/ Are there any React hooks that handle WebSocket connections? List them with file paths"


  Verify error handling:
  gemini -p "@src/ @api/ Is proper error handling implemented for all API endpoints? Show examples of try-catch blocks"


  Check for rate limiting:
  gemini -p "@backend/ @middleware/ Is rate limiting implemented for the API? Show the implementation details"


  Verify caching strategy:
  gemini -p "@src/ @lib/ @services/ Is Redis caching implemented? List all cache-related functions and their usage"


  Check for specific security measures:
  gemini -p "@src/ @api/ Are SQL injection protections implemented? Show how user inputs are sanitized"


  Verify test coverage for features:
  gemini -p "@src/payment/ @tests/ Is the payment processing module fully tested? List all test cases"


  When to Use Gemini CLI


  Use gemini -p when:
  - Analyzing entire codebases or large directories
  - Comparing multiple large files
  - Need to understand project-wide patterns or architecture
  - Current context window is insufficient for the task
  - Working with files totaling more than 100KB
  - Verifying if specific features, patterns, or security measures are implemented
  - Checking for the presence of certain coding patterns across the entire codebase


  Important Notes


  - Paths in @ syntax are relative to your current working directory when invoking gemini
  - The CLI will include file contents directly in the context
  - No need for --yolo flag for read-only analysis
  - Gemini's context window can handle entire codebases that would overflow Claude's context
  - When checking implementations, be specific about what you're looking for to get accurate results