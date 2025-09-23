# Enhanced Web Scraper MCP Server

A professional Model Context Protocol (MCP) server for web scraping, React app testing, and React Native web app inspection using Playwright. **Fully backward compatible** with regular websites and standard React applications.

## 🚀 Latest Improvements

- **🔥 Context-Optimized Screenshots** - Screenshots return only file paths and analysis text (no base64 data)
- **📊 Enhanced Page Analysis** - Detailed element counting, content structure analysis, and page state inspection
- **🔍 Comprehensive Comparison Tools** - Visual similarity analysis with layout, color, and typography detection
- **💾 File-Based Output** - All screenshots saved to `/tmp/` with structured analysis data
- **🎯 Smart Content Detection** - Automatically detects empty states, loading indicators, and content availability
- **Enhanced Error Handling** - Comprehensive input validation and error reporting
- **Optimized Performance** - Reduced code duplication and improved efficiency  
- **Standardized Timeouts** - Configurable timeout constants for reliability
- **Professional Code Structure** - ES6+ best practices and maintainable architecture

## 🔄 Backward Compatibility

This enhanced server maintains **100% compatibility** with:
- ✅ **Regular websites** (HTML, CSS, JavaScript)
- ✅ **Standard React applications** (Create React App, Next.js, etc.)
- ✅ **Traditional web scraping** workflows
- ✅ **Existing CSS selectors** and interactions

**Plus new enhanced support for:**
- 🆕 **React Native web applications**
- 🆕 **Expo web projects**
- 🆕 **Mobile viewport emulation**
- 🆕 **Advanced React component inspection**

## 📋 Tools Overview

| Tool | Purpose | Best For |
|------|---------|----------|
| [`take_screenshot`](#1-take_screenshot---context-free-screenshot-capture) | Context-free screenshot capture | Visual analysis, UI documentation |
| [`compare_screenshots`](#2-compare_screenshots---visual-ui-comparison) | Visual UI comparison with semantic analysis | UI replication, visual regression testing |
| [`scrape_page`](#3-scrape_page---universal-web-scraping) | Universal web scraping | Content extraction, data collection |
| [`test_react_app`](#4-test_react_app---universal-react-testing) | React app testing with mobile gestures | UI testing, interaction automation |
| [`get_page_info`](#5-get_page_info---enhanced-page-analysis) | Page analysis with React insights | Performance monitoring, framework detection |
| [`extract_content`](#6-extract_content---clean-content-extraction) | Clean content extraction | Documentation, article processing |
| [`wait_for_element`](#7-wait_for_element---smart-element-waiting) | Smart element waiting | Dynamic content, loading states |
| [`inspect_react_app`](#8-inspect_react_app---react-component-analysis) | React component analysis | Component debugging, state inspection |
| [`wait_for_react_state`](#9-wait_for_react_state---react-state-management) | React state management | Hydration, navigation, data loading |
| [`execute_in_react_context`](#10-execute_in_react_context---javascript-execution) | JavaScript execution in React context | Advanced debugging, custom scripts |
| [`check_expo_dev_server`](#11-check_expo_dev_server---expo-development-tools) | Expo development server status | Development workflow, debugging |

## Key Features for AI Visual Analysis

### 🔥 Context-Free Design
- **No Base64 Data**: Screenshots return only file paths and analysis text
- **Minimal Context Usage**: Dramatically reduced token consumption per screenshot
- **File-Based Storage**: All images saved to `/tmp/` for external access
- **Structured Analysis**: Rich text analysis without heavy image data

### 🔍 Smart Content Detection
- **Empty State Detection**: Automatically identifies when pages have no meaningful content
- **Table Population Verification**: Counts table rows to verify data is actually displaying
- **Loading State Recognition**: Detects and waits for loading indicators to disappear
- **Content Structure Analysis**: Provides detailed breakdown of page elements

### 📁 File-Based Output
Every visual tool provides:
1. **📊 Analysis Text**: Element counts, text content, structural analysis
2. **📁 File Path**: Saved screenshot location for external viewing
3. **🎯 Pass/Fail Status**: Built-in success criteria for automated workflows

### 🎯 Migration & Testing Support
Perfect for:
- **UI Migration Verification**: Compare source vs target implementations
- **Mock Data Validation**: Verify that mock data is actually displaying
- **Visual Regression Testing**: Ensure UI changes don't break layouts
- **Component Testing**: Validate React components render correctly

### 📊 Success Metrics Integration
- **Configurable Similarity Thresholds**: Built-in pass/fail criteria for visual comparisons
- **Populated Data Requirements**: Detects empty states that prevent meaningful comparison
- **Comprehensive Reporting**: Detailed analysis for debugging visual differences

## Available Tools

### 1. `take_screenshot` - Context-Free Screenshot Capture
Captures screenshots with comprehensive analysis while keeping context usage minimal.

```javascript
{
  url: "https://example.com",
  browser: "chromium",
  device: "iPhone 12", // Optional device emulation
  fullPage: true,
  waitForSPA: true // Auto-detects and waits for React/Vue/Angular apps
}
```

**Returns:**
- **📊 Comprehensive Analysis**: Element counts, page structure, content preview
- **📁 File Path**: Screenshot saved to `/tmp/screenshot-[timestamp].png`
- **🎯 Content Status**: Pass/fail indicators for populated data

**Example Output:**
```
📸 Screenshot saved to: /tmp/screenshot-1234567890.png

📄 Page Analysis:
- Title: "My React App"
- Has Content: ✅
- Visible Elements: 247

📊 Content Elements:
- Headings: 3
- Paragraphs: 12
- Buttons: 8
- Tables: 1
- Table Rows: 15  ← Indicates populated data!

📝 Page Content Preview:
Welcome to our service platform. Here you can find contractors...
```

### 2. `compare_screenshots` - Context-Free Visual Comparison
Compares two pages with comprehensive analysis while maintaining minimal context usage.

```javascript
{
  urlA: "https://source-design.com", // Source/reference
  urlB: "https://your-implementation.com", // Target/implementation
  browser: "chromium",
  threshold: 0.1, // Similarity threshold (0-1)
  analyzeLayout: true, // Detect alignment differences
  analyzeColors: true, // Exact color comparison
  analyzeTypography: true, // Font size/weight analysis
  waitForSPA: true // Smart SPA detection
}
```

**Returns:**
- **📊 Visual Similarity Score**: Percentage match with pass/fail status
- **🏗️ Structural Comparison**: Element counts, table rows, content structure
- **🎨 Layout Analysis**: Alignment differences, positioning issues
- **📁 File Paths**: Both screenshots saved to `/tmp/` for external viewing

**Example Output:**
```
📸 Screenshots saved:
- Source: /tmp/compare-source-1234567890.png
- Target: /tmp/compare-target-1234567891.png

📊 VISUAL SIMILARITY: 87.3% ✅ PASS

🏗️ Structural Comparison:
- Tables: 1 → 1
- Table Rows: 0 → 8  ← Target has populated data!
- Buttons: 12 → 12

📋 Layout Analysis:
- 2 regions with significant layout differences
- Content appears centered in source but left-aligned in target

🎨 Color Analysis:
- Minor color differences detected
- Example: rgb(229, 122, 68) → rgb(225, 118, 64)
```

### 3. `scrape_page` - Universal Web Scraping
Works with **any website** - regular HTML, React apps, or React Native web.

**Regular website example:**
```javascript
{
  url: "https://example.com",
  selector: ".article-title", // Standard CSS selector
  screenshot: true
}
```

**React Native web example:**
```javascript
{
  url: "http://localhost:8081",
  selector: "login-button", // Will try testID, aria-label fallbacks
  mobileViewport: true,
  device: "iPhone 12"
}
```

### 4. `test_react_app` - Universal React Testing
Works with **any React application** - standard React or React Native web.

**Standard React app example:**
```javascript
{
  url: "http://localhost:3000",
  waitForHydration: false, // Optional for regular React apps
  actions: [
    { type: "click", selector: "#submit-button" },
    { type: "fill", selector: "input[name='email']", value: "test@example.com" }
  ]
}
```

**React Native web example:**
```javascript
{
  url: "http://localhost:8081",
  device: "iPhone 12",
  waitForHydration: true, // Recommended for RN web
  actions: [
    { type: "tap", selector: "login-button" },
    { type: "swipe", selector: "scroll-view", value: "up" }
  ]
}
```

### 5. `get_page_info` - Enhanced Page Analysis
Provides comprehensive information for any web page with React-specific insights.

```javascript
{
  url: "https://any-website.com", // Works with any URL
  includePerformance: true
}
```

### 6. `extract_content` - Clean Content Extraction
Extract clean, readable content from web pages without HTML/CSS clutter. Perfect for documentation, articles, and structured content consumption.

```javascript
{
  url: "https://docs.example.com/api-guide",
  includeLinks: true,    // Extract and categorize hyperlinks
  format: "markdown"     // Output format: 'markdown' or 'text'
}
```

**Output Example:**
```markdown
# API Documentation

## Authentication
You need to obtain an API key [1] from the developer portal [2].

### Rate Limits
See the rate limiting guide [3] for details.

---
## Links Found:
[1] https://example.com/api-keys (internal)
[2] https://developer.example.com (external) 
[3] https://example.com/docs/rate-limits (internal)
```

**Features:**
- **Clean Structure** - Preserves headings, paragraphs, lists, code blocks
- **Link Extraction** - Categorizes links as internal, external, anchor, or download
- **Content Filtering** - Removes navigation, ads, sidebars automatically
- **Multiple Formats** - Markdown or plain text output

### 7. `wait_for_element` - Smart Element Waiting
Intelligent element waiting with automatic selector strategy fallbacks.

```javascript
{
  url: "https://example.com",
  selector: ".loading-spinner", // CSS selector with RN fallbacks
  timeout: 10000
}
```

## React Native Web Specific Tools

### 8. `inspect_react_app` - React Component Analysis
Deep inspection of React applications (works best with React Native web).

### 9. `wait_for_react_state` - React State Management
Wait for React-specific conditions like hydration, navigation, data loading.

### 10. `execute_in_react_context` - JavaScript Execution
Execute JavaScript in React context for advanced inspection.

### 11. `check_expo_dev_server` - Expo Development Tools
Check Expo/Metro bundler status for development workflows.

## Selector Strategy Priority

The server uses intelligent selector strategies:

1. **Primary**: Direct CSS selector (e.g., `#button`, `.class`, `input[name='email']`)
2. **Fallback 1**: TestID attribute (`[data-testid="button"]`)
3. **Fallback 2**: Accessibility label (`[aria-label="Button"]`)
4. **Fallback 3**: AccessibilityLabel (`[accessibilityLabel="Button"]`)

This ensures **regular CSS selectors work normally** while providing React Native web compatibility.

## Usage Examples

### Context-Free Visual Verification
```javascript
// Verify data is actually displaying without burning context
{
  url: "http://localhost:3000/data-table",
  fullPage: true,
  waitForSPA: true
}
// Returns: File path + "Table Rows: 8" ← Confirms data is populated!
```

### Context-Free Migration Comparison
```javascript
// Compare source vs target implementation efficiently
{
  urlA: "http://localhost:3001/page", // Source
  urlB: "http://localhost:3000/page", // Target
  threshold: 0.05, // High similarity requirement
  analyzeLayout: true,
  analyzeColors: true
}
// Returns: File paths + "VISUAL SIMILARITY: 96.2% ✅ PASS"
```

### Regular Website Scraping
```javascript
// Works exactly like before
{
  url: "https://news.ycombinator.com",
  selector: ".storylink",
  screenshot: false
}
```

### Standard React App Testing
```javascript
// Standard React app (Create React App, Next.js, etc.)
{
  url: "http://localhost:3000",
  actions: [
    { type: "click", selector: "button.login" },
    { type: "fill", selector: "#username", value: "testuser" }
  ]
}
```

### React Native Web App Testing
```javascript
// React Native web with enhanced features
{
  url: "http://localhost:8081",
  device: "iPhone 12",
  waitForHydration: true,
  actions: [
    { type: "tap", selector: "login-button" }, // Uses testID
    { type: "swipe", selector: "scroll-view", value: "up" }
  ]
}
```

### Clean Content Extraction
```javascript
// Extract clean content from documentation
{
  url: "https://docs.react.dev/learn",
  includeLinks: true,
  format: "markdown"
}
```

## Installation

```bash
npm install
npx playwright install
```

## Usage with Amazon Q Developer

```bash
# Take a context-free screenshot and analyze content
q chat "Take a screenshot of localhost:3000/data-page and analyze the content"

# Compare pages efficiently without context bloat
q chat "Compare the page between localhost:3001 and localhost:3000"

# Mock data verification with minimal context usage
q chat "Verify that the data table is populated at localhost:3000"

# Works with any website
q chat "Scrape the headlines from https://news.ycombinator.com"

# Works with React apps
q chat "Test the login flow on my React app at localhost:3000"

# Enhanced React Native web support
q chat "Inspect the React Native web app at localhost:8081"

# Extract clean content for reading
q chat "Extract the main content from https://docs.react.dev/learn"
```

## Benefits of Context-Free Design

### 🔥 Dramatically Reduced Context Usage
- **Before**: 50-200KB base64 data per screenshot
- **After**: Only text analysis (~1-2KB per screenshot)
- **Result**: 50-100x reduction in context consumption

### 📁 File-Based Workflow
- Screenshots saved to `/tmp/` with timestamps
- External tools can access images directly
- No context pollution from image data
- Structured analysis data remains in conversation

### 🎯 Better AI Workflows
- More screenshots possible per conversation
- Focus on analysis rather than data transfer
- Cleaner conversation history
- Faster response times

## Troubleshooting

### Error Handling
- **Input Validation** - Server validates required parameters and provides clear error messages
- **Timeout Configuration** - Default timeouts are optimized but can be adjusted per request
- **Browser Cleanup** - Automatic resource cleanup prevents memory leaks

### Regular Websites
- Use standard CSS selectors (`.class`, `#id`, `tag[attribute]`)
- Set `mobileViewport: false` (default) for desktop sites
- Set `waitForHydration: false` (default) for non-React sites

### React Applications
- Set `waitForHydration: true` for better reliability
- Use semantic selectors when possible
- Check browser console for React errors

### React Native Web
- Use `testID` attributes in your components
- Enable `mobileViewport` or specify `device`
- Set `waitForHydration: true`
- Use `inspect_react_app` to see available elements

## License

MIT
