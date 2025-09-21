# Enhanced Web Scraper MCP Server

An enhanced Model Context Protocol (MCP) server for web scraping, React app testing, and React Native web app inspection using Playwright. **Fully backward compatible** with regular websites and standard React applications.

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

## Features

### 🌐 Universal Web Scraping
- **Multi-browser support** (Chromium, Firefox, WebKit)
- **Regular CSS selectors** work as expected
- **Automatic fallback** to React Native selectors when needed
- **Mobile viewport emulation** (optional)
- **Device-specific emulation** (iPhone, Pixel, etc.)

### 📱 Enhanced React Support
- **Regular React apps** - Works with standard React applications
- **React Native web** - Enhanced support for RN web components
- **React hydration detection** - Smart waiting for React apps to load
- **Component tree analysis** - Deep React component inspection
- **TestID and accessibility support** - React Native testing patterns
- **Mobile gesture simulation** - Touch interactions for mobile UX

### 🔧 Development Tools
- **Expo development integration** - Metro bundler health checks
- **Framework detection** - Identifies React, Expo, and React Native web
- **Performance monitoring** - Load times and metrics
- **Debug capabilities** - Enhanced error reporting

## Available Tools

### 1. `scrape_page` - Universal Web Scraping
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

### 2. `test_react_app` - Universal React Testing
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

### 3. `get_page_info` - Enhanced Page Analysis
Provides comprehensive information for any web page with React-specific insights.

```javascript
{
  url: "https://any-website.com", // Works with any URL
  includePerformance: true
}
```

### 4. `wait_for_element` - Smart Element Waiting
Intelligent element waiting with automatic selector strategy fallbacks.

```javascript
{
  url: "https://example.com",
  selector: ".loading-spinner", // CSS selector with RN fallbacks
  timeout: 10000
}
```

## React Native Web Specific Tools

### 5. `inspect_react_app` - React Component Analysis
Deep inspection of React applications (works best with React Native web).

### 6. `wait_for_react_state` - React State Management
Wait for React-specific conditions like hydration, navigation, data loading.

### 7. `execute_in_react_context` - JavaScript Execution
Execute JavaScript in React context for advanced inspection.

### 8. `check_expo_dev_server` - Expo Development Tools
Check Expo/Metro bundler status for development workflows.

## Selector Strategy Priority

The server uses intelligent selector strategies:

1. **Primary**: Direct CSS selector (e.g., `#button`, `.class`, `input[name='email']`)
2. **Fallback 1**: TestID attribute (`[data-testid="button"]`)
3. **Fallback 2**: Accessibility label (`[aria-label="Button"]`)
4. **Fallback 3**: AccessibilityLabel (`[accessibilityLabel="Button"]`)

This ensures **regular CSS selectors work normally** while providing React Native web compatibility.

## Usage Examples

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

## Installation

```bash
npm install
npx playwright install
```

## Usage with Amazon Q Developer

```bash
# Works with any website
q chat "Scrape the headlines from https://news.ycombinator.com"

# Works with React apps
q chat "Test the login flow on my React app at localhost:3000"

# Enhanced React Native web support
q chat "Inspect the React Native web app at localhost:8081"
```

## Migration Guide

**No migration needed!** Your existing workflows continue to work:

- ✅ All existing `scrape_page` calls work unchanged
- ✅ All existing `test_react_app` calls work unchanged  
- ✅ All existing CSS selectors work unchanged
- ✅ All existing parameters work unchanged

**New optional features:**
- Add `mobileViewport: true` for mobile rendering
- Add `device: "iPhone 12"` for device emulation
- Add `waitForHydration: true` for React apps
- Use testID selectors for React Native web elements

## Troubleshooting

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
