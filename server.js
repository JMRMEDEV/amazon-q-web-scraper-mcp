#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { chromium, firefox, webkit, devices } from 'playwright';
import fs from 'fs';
import { createCanvas, loadImage } from 'canvas';
import sharp from 'sharp';

// Constants
const TIMEOUTS = {
  DEFAULT: 10000,
  HYDRATION: 15000,
  NAVIGATION: 5000,
  SCREENSHOT_WAIT: 3000
};

const MOBILE_VIEWPORT = {
  width: 375,
  height: 667,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1'
};

const BROWSER_ARGS = ['--no-sandbox', '--disable-setuid-sandbox'];

class WebScraperServer {
  constructor() {
    this.server = new Server(
      {
        name: 'web-scraper',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
    this.setupErrorHandling();
  }

  setupErrorHandling() {
    this.server.onerror = (error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  // Utility methods
  validateArgs(args, required = []) {
    if (!args) throw new Error('Arguments are required');
    for (const field of required) {
      if (!args[field]) throw new Error(`Missing required field: ${field}`);
    }
  }

  async getBrowser(browserType = 'chromium', deviceName = null) {
    const browsers = { chromium, firefox, webkit };
    const browser = await browsers[browserType].launch({ 
      headless: true,
      args: BROWSER_ARGS
    });
    
    const context = deviceName && devices[deviceName] 
      ? await browser.newContext(devices[deviceName])
      : await browser.newContext();
      
    return { browser, context };
  }

  async setupMobileViewport(page, deviceName = null) {
    if (deviceName && devices[deviceName]) return;
    
    await page.setViewportSize({ width: MOBILE_VIEWPORT.width, height: MOBILE_VIEWPORT.height });
    await page.setExtraHTTPHeaders({ 'User-Agent': MOBILE_VIEWPORT.userAgent });
  }

  async findElement(page, selector, timeout = TIMEOUTS.DEFAULT) {
    const selectors = [
      selector,
      `[data-testid="${selector}"]`,
      `[aria-label="${selector}"]`,
      `[accessibilityLabel="${selector}"]`
    ];
    
    for (const sel of selectors) {
      try {
        await page.waitForSelector(sel, { timeout: timeout / selectors.length });
        return { element: await page.$(sel), usedSelector: sel };
      } catch (e) {
        continue;
      }
    }
    throw new Error(`Element not found with any selector: ${selector}`);
  }

  async waitForReactHydration(page, timeout = TIMEOUTS.HYDRATION) {
    try {
      await page.waitForFunction(() => {
        return window.React || window.__REACT_DEVTOOLS_GLOBAL_HOOK__ || 
               document.querySelector('[data-reactroot]') ||
               document.querySelector('#root [data-testid]') ||
               document.querySelector('.expo-web-view');
      }, { timeout });

      await page.waitForTimeout(1000);
      
      const loadingSelectors = [
        '[data-testid*="loading"]',
        '[data-testid*="spinner"]', 
        '.loading',
        '.spinner',
        '[aria-label*="loading"]'
      ];
      
      for (const selector of loadingSelectors) {
        try {
          await page.waitForSelector(selector, { state: 'detached', timeout: 5000 });
        } catch (e) {
          // Loading indicator might not exist, continue
        }
      }
      
      return true;
    } catch (error) {
      console.warn('React hydration wait failed:', error.message);
      return false;
    }
  }

  setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'inspect_element',
          description: 'Inspect a DOM element by selector and return its attributes, text, and computed styles',
          inputSchema: {
            type: 'object',
            properties: {
              url: { type: 'string', description: 'Page URL to inspect' },
              selector: { type: 'string', description: 'CSS selector of element' },
              properties: {
                type: 'array',
                items: { type: 'string' },
                description: 'Optional list of CSS properties'
              },
              browser: {
                type: 'string',
                enum: ['chromium','firefox','webkit'],
                default: 'chromium'
              }
            },
            required: ['url','selector'],
            additionalProperties: false
          }
        },	
        {
          name: 'scrape_page',
          description: 'Scrape content from any web page (regular websites, React apps, or React Native web apps) using Playwright',
          inputSchema: {
            type: 'object',
            properties: {
              url: {
                type: 'string',
                description: 'URL to scrape'
              },
              selector: {
                type: 'string',
                description: 'CSS selector to target specific elements (supports regular CSS and React Native testID/aria-label fallbacks)'
              },
              browser: {
                type: 'string',
                enum: ['chromium', 'firefox', 'webkit'],
                default: 'chromium',
                description: 'Browser engine to use'
              },
              waitFor: {
                type: 'string',
                description: 'Wait for specific selector or timeout in ms (e.g., "2000" or "#my-element")'
              },
              screenshot: {
                type: 'boolean',
                default: false,
                description: 'Take a screenshot of the page'
              },
              mobileViewport: {
                type: 'boolean',
                default: false,
                description: 'Use mobile viewport (primarily for React Native web apps)'
              },
              device: {
                type: 'string',
                description: 'Device to emulate (e.g., "iPhone 12", "Pixel 5") - for mobile web apps'
              }
            },
            required: ['url']
          }
        },
        {
          name: 'inspect_react_app',
          description: 'Inspect React Native web app with component tree, props, and state analysis',
          inputSchema: {
            type: 'object',
            properties: {
              url: {
                type: 'string',
                description: 'URL of the React Native web app'
              },
              waitForHydration: {
                type: 'boolean',
                default: true,
                description: 'Wait for React hydration to complete'
              },
              includeComponentTree: {
                type: 'boolean',
                default: true,
                description: 'Include React component tree analysis'
              },
              includeState: {
                type: 'boolean',
                default: false,
                description: 'Include React state inspection (requires React DevTools)'
              },
              browser: {
                type: 'string',
                enum: ['chromium', 'firefox', 'webkit'],
                default: 'chromium',
                description: 'Browser engine to use'
              },
              device: {
                type: 'string',
                description: 'Device to emulate (e.g., "iPhone 12", "Pixel 5")'
              }
            },
            required: ['url']
          }
        },
        {
          name: 'wait_for_react_state',
          description: 'Wait for React component state changes, data loading, or navigation',
          inputSchema: {
            type: 'object',
            properties: {
              url: {
                type: 'string',
                description: 'URL to monitor'
              },
              condition: {
                type: 'string',
                enum: ['hydration', 'navigation', 'data-loading', 'animation', 'custom'],
                description: 'Type of condition to wait for'
              },
              selector: {
                type: 'string',
                description: 'CSS selector or testID to wait for (for custom condition)'
              },
              timeout: {
                type: 'number',
                default: 15000,
                description: 'Maximum time to wait in milliseconds'
              },
              browser: {
                type: 'string',
                enum: ['chromium', 'firefox', 'webkit'],
                default: 'chromium',
                description: 'Browser engine to use'
              }
            },
            required: ['url', 'condition']
          }
        },
        {
          name: 'execute_in_react_context',
          description: 'Execute JavaScript in React context to inspect components, state, or trigger actions',
          inputSchema: {
            type: 'object',
            properties: {
              url: {
                type: 'string',
                description: 'URL of the React app'
              },
              script: {
                type: 'string',
                description: 'JavaScript code to execute in the browser context'
              },
              waitForReact: {
                type: 'boolean',
                default: true,
                description: 'Wait for React to be available before executing'
              },
              browser: {
                type: 'string',
                enum: ['chromium', 'firefox', 'webkit'],
                default: 'chromium',
                description: 'Browser engine to use'
              }
            },
            required: ['url', 'script']
          }
        },
        {
          name: 'check_expo_dev_server',
          description: 'Check if Expo development server is running and get app status',
          inputSchema: {
            type: 'object',
            properties: {
              port: {
                type: 'number',
                default: 8081,
                description: 'Port where Expo dev server is running'
              },
              host: {
                type: 'string',
                default: 'localhost',
                description: 'Host where Expo dev server is running'
              }
            }
          }
        },
        {
          name: 'test_react_app',
          description: 'Test any React app (regular React or React Native web) with enhanced interactions and mobile gestures',
          inputSchema: {
            type: 'object',
            properties: {
              url: {
                type: 'string',
                description: 'URL of the React app (e.g., http://localhost:3000 for regular React, http://localhost:8081 for RN web)'
              },
              actions: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    type: {
                      type: 'string',
                      enum: ['click', 'fill', 'wait', 'screenshot', 'getText', 'getAttribute', 'swipe', 'scroll', 'tap', 'longPress', 'waitForNavigation']
                    },
                    selector: {
                      type: 'string',
                      description: 'CSS selector, testID, or accessibility label for the element'
                    },
                    value: {
                      type: 'string',
                      description: 'Value for fill actions, attribute name for getAttribute, or direction for swipe'
                    },
                    timeout: {
                      type: 'number',
                      default: 10000,
                      description: 'Timeout in milliseconds'
                    },
                    coordinates: {
                      type: 'object',
                      properties: {
                        x: { type: 'number' },
                        y: { type: 'number' }
                      },
                      description: 'Coordinates for tap/swipe actions'
                    }
                  },
                  required: ['type']
                },
                description: 'Array of actions to perform on the React Native web app'
              },
              browser: {
                type: 'string',
                enum: ['chromium', 'firefox', 'webkit'],
                default: 'chromium',
                description: 'Browser engine to use'
              },
              device: {
                type: 'string',
                description: 'Device to emulate (e.g., "iPhone 12", "Pixel 5")'
              },
              waitForHydration: {
                type: 'boolean',
                default: false,
                description: 'Wait for React hydration before starting tests (recommended for React apps, especially React Native web)'
              }
            },
            required: ['url', 'actions']
          }
        },
        {
          name: 'get_page_info',
          description: 'Get comprehensive information about a web page (title, meta tags, performance metrics)',
          inputSchema: {
            type: 'object',
            properties: {
              url: {
                type: 'string',
                description: 'URL to analyze'
              },
              browser: {
                type: 'string',
                enum: ['chromium', 'firefox', 'webkit'],
                default: 'chromium',
                description: 'Browser engine to use'
              },
              includePerformance: {
                type: 'boolean',
                default: false,
                description: 'Include performance metrics'
              }
            },
            required: ['url']
          }
        },
        {
          name: 'test_dropdown_with_error_capture',
          description: 'Test dropdown interactions with comprehensive console error capture and page state monitoring',
          inputSchema: {
            type: 'object',
            properties: {
              url: {
                type: 'string',
                description: 'URL of the React app'
              },
              dropdownSelector: {
                type: 'string',
                description: 'CSS selector, testID, or text content to identify the dropdown button'
              },
              waitAfterClick: {
                type: 'number',
                default: 3000,
                description: 'Time to wait after clicking to capture errors (ms)'
              },
              browser: {
                type: 'string',
                enum: ['chromium', 'firefox', 'webkit'],
                default: 'chromium',
                description: 'Browser engine to use'
              },
              takeScreenshots: {
                type: 'boolean',
                default: true,
                description: 'Take before/after screenshots'
              }
            },
            required: ['url', 'dropdownSelector']
          }
        },
        {
          name: 'wait_for_element',
          description: 'Wait for an element to appear on the page (useful for dynamic React content)',
          inputSchema: {
            type: 'object',
            properties: {
              url: {
                type: 'string',
                description: 'URL to monitor'
              },
              selector: {
                type: 'string',
                description: 'CSS selector to wait for'
              },
              timeout: {
                type: 'number',
                default: 10000,
                description: 'Maximum time to wait in milliseconds'
              },
              browser: {
                type: 'string',
                enum: ['chromium', 'firefox', 'webkit'],
                default: 'chromium',
                description: 'Browser engine to use'
              }
            },
            required: ['url', 'selector']
          }
        },
        {
          name: 'extract_content',
          description: 'Extract clean, readable content from web pages with semantic structure and hyperlinks',
          inputSchema: {
            type: 'object',
            properties: {
              url: {
                type: 'string',
                description: 'URL to extract content from'
              },
              includeLinks: {
                type: 'boolean',
                default: true,
                description: 'Include hyperlinks with categorization'
              },
              format: {
                type: 'string',
                enum: ['markdown', 'text'],
                default: 'markdown',
                description: 'Output format'
              },
              browser: {
                type: 'string',
                enum: ['chromium', 'firefox', 'webkit'],
                default: 'chromium',
                description: 'Browser engine to use'
              }
            },
            required: ['url']
          }
        },
        {
          name: 'take_screenshot',
          description: 'Take screenshot of a page without extracting HTML/CSS content',
          inputSchema: {
            type: 'object',
            properties: {
              url: {
                type: 'string',
                description: 'URL to capture screenshot from'
              },
              browser: {
                type: 'string',
                enum: ['chromium', 'firefox', 'webkit'],
                default: 'chromium',
                description: 'Browser engine to use'
              },
              device: {
                type: 'string',
                description: 'Device to emulate (e.g., "iPhone 12", "Pixel 5")'
              },
              fullPage: {
                type: 'boolean',
                default: true,
                description: 'Capture full page or just viewport'
              },
              waitForSPA: {
                type: 'boolean',
                default: true,
                description: 'Wait for SPA frameworks to load and hydrate'
              }
            },
            required: ['url']
          }
        },
        {
          name: 'compare_screenshots',
          description: 'Take screenshots of two pages and compare them visually for layout, colors, and typography',
          inputSchema: {
            type: 'object',
            properties: {
              urlA: {
                type: 'string',
                description: 'First page (source)'
              },
              urlB: {
                type: 'string',
                description: 'Second page (target)'
              },
              browser: {
                type: 'string',
                enum: ['chromium', 'firefox', 'webkit'],
                default: 'chromium',
                description: 'Browser engine to use'
              },
              threshold: {
                type: 'number',
                default: 0.1,
                description: 'Allowed difference ratio (0–1)'
              },
              analyzeLayout: {
                type: 'boolean',
                default: true,
                description: 'Analyze layout positioning and alignment'
              },
              analyzeColors: {
                type: 'boolean',
                default: true,
                description: 'Analyze exact color differences'
              },
              analyzeTypography: {
                type: 'boolean',
                default: true,
                description: 'Analyze font sizes, weights, and spacing'
              },
              waitForSPA: {
                type: 'boolean',
                default: true,
                description: 'Wait for SPA frameworks to load and hydrate'
              }
            },
            required: ['urlA', 'urlB']
          }
        }
      ]
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'inspect_element': {
            const normalized = Array.isArray(args) ? { url: args[0], selector: args[1] } : args;
            return await this.inspectElement(normalized);
          }
          case 'scrape_page':
            return await this.scrapePage(args);
          case 'inspect_react_app':
            return await this.inspectReactApp(args);
          case 'wait_for_react_state':
            return await this.waitForReactState(args);
          case 'execute_in_react_context':
            return await this.executeInReactContext(args);
          case 'check_expo_dev_server':
            return await this.checkExpoDevServer(args);
          case 'test_react_app':
            return await this.testReactApp(args);
          case 'get_page_info':
            return await this.getPageInfo(args);
          case 'test_dropdown_with_error_capture':
            return await this.testDropdownWithErrorCapture(args);
          case 'wait_for_element':
            return await this.waitForElement(args);
          case 'extract_content':
            return await this.extractContent(args);
          case 'take_screenshot':
            return await this.takeScreenshot(args);
          case 'compare_screenshots':
            return await this.compareScreenshots(args);
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Error: ${error.message}` }],
          isError: true
        };
      }
    });
  }

  async inspectElement(args) {
    this.validateArgs(args, ['url', 'selector']);
    const { url, selector, properties = [], browser: browserType = 'chromium' } = args;

    const { browser, context } = await this.getBrowser(browserType);
    const page = await context.newPage();

    try {
      await page.goto(url, { waitUntil: 'networkidle' });

      const data = await page.evaluate(({ selector: sel, properties: props }) => {
        const el = document.querySelector(sel);
        if (!el) return { error: `Element ${sel} not found` };

        const styles = window.getComputedStyle(el);
        const selected = props?.length > 0
          ? props.reduce((acc, p) => { acc[p] = styles.getPropertyValue(p); return acc; }, {})
          : Object.fromEntries(Array.from(styles).map(p => [p, styles.getPropertyValue(p)]));

        return {
          tag: el.tagName,
          id: el.id,
          className: el.className,
          text: el.textContent?.trim(),
          styles: selected
        };
      }, { selector, properties });

      return {
        content: [{
          type: 'text',
          text: `Inspection result for ${selector} on ${url}:\n\n${JSON.stringify(data, null, 2)}`
        }]
      };
    } finally {
      await context.close();
      await browser.close();
    }
  }
  

  async scrapePage(args) {
    this.validateArgs(args, ['url']);
    const { 
      url, 
      selector, 
      browser: browserType = 'chromium', 
      waitFor, 
      screenshot,
      mobileViewport = false,
      device
    } = args;
    
    const { browser, context } = await this.getBrowser(browserType, device);
    const page = await context.newPage();
    
    try {
      if (mobileViewport && !device) {
        await this.setupMobileViewport(page);
      }

      await page.goto(url, { waitUntil: 'networkidle' });
      
      if (mobileViewport || device || url.includes('expo') || url.includes(':8081')) {
        await this.waitForReactHydration(page);
      }
      
      if (waitFor) {
        if (waitFor.match(/^\d+$/)) {
          await page.waitForTimeout(parseInt(waitFor));
        } else {
          try {
            await this.findElement(page, waitFor);
          } catch (e) {
            throw new Error(`Element not found with any selector strategy: ${waitFor}`);
          }
        }
      }

      let content;
      if (selector) {
        try {
          const { element } = await this.findElement(page, selector);
          const elements = await page.$$(selector);
          content = await Promise.all(elements.map(async (el) => await el.textContent()));
        } catch (e) {
          content = 'No elements found with the provided selector';
        }
      } else {
        content = await page.textContent('body');
      }

      const result = {
        content: [{
          type: 'text',
          text: `Scraped content from ${url}:\n\n${
            Array.isArray(content) 
              ? content.map(item => typeof item === 'object' 
                  ? `${item.tagName}: "${item.text}" (testId: ${item.testId}, label: ${item.accessibilityLabel})`
                  : item
                ).join('\n---\n')
              : content
          }`
        }]
      };

      if (screenshot) {
        const screenshotBuffer = await page.screenshot({ fullPage: true });
        const screenshotPath = `/tmp/screenshot-${Date.now()}.png`;
        fs.writeFileSync(screenshotPath, screenshotBuffer);
        result.content.push({
          type: 'text',
          text: `Screenshot saved to: ${screenshotPath}`
        });
      }

      return result;
    } finally {
      await context.close();
      await browser.close();
    }
  }

  async inspectReactApp(args) {
    const { 
      url, 
      waitForHydration = true,
      includeComponentTree = true,
      includeState = false,
      browser: browserType = 'chromium',
      device
    } = args;
    
    const { browser, context } = await this.getBrowser(browserType, device);
    const page = await context.newPage();
    
    try {
      if (!device) {
        await this.setupMobileViewport(page);
      }

      await page.goto(url, { waitUntil: 'networkidle' });
      
      if (waitForHydration) {
        await this.waitForReactHydration(page);
      }

      const inspection = await page.evaluate((options) => {
        const results = {
          reactDetected: false,
          expoDetected: false,
          componentTree: [],
          reactNativeElements: [],
          errors: [],
          performance: {}
        };

        // Detect React
        if (window.React || window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
          results.reactDetected = true;
        }

        // Detect Expo
        if (window.expo || document.querySelector('.expo-web-view') || 
            window.__EXPO_WEB__ || window.ExpoModules) {
          results.expoDetected = true;
        }

        // Find React Native web elements
        const rnElements = document.querySelectorAll('[data-testid], [accessibilityLabel], [role]');
        results.reactNativeElements = Array.from(rnElements).map(el => ({
          tagName: el.tagName.toLowerCase(),
          testId: el.getAttribute('data-testid'),
          accessibilityLabel: el.getAttribute('aria-label') || el.getAttribute('accessibilityLabel'),
          role: el.getAttribute('role'),
          text: el.textContent?.trim().substring(0, 100),
          className: el.className,
          id: el.id
        }));

        // Component tree analysis (basic)
        if (options.includeComponentTree) {
          const rootElement = document.querySelector('#root, [data-reactroot], .expo-web-view');
          if (rootElement) {
            const analyzeElement = (element, depth = 0) => {
              if (depth > 5) return null; // Limit depth
              
              return {
                tagName: element.tagName.toLowerCase(),
                testId: element.getAttribute('data-testid'),
                className: element.className,
                childCount: element.children.length,
                hasText: element.textContent?.trim().length > 0,
                children: Array.from(element.children)
                  .slice(0, 10) // Limit children
                  .map(child => analyzeElement(child, depth + 1))
                  .filter(Boolean)
              };
            };
            
            results.componentTree = analyzeElement(rootElement);
          }
        }

        // Capture console errors
        results.errors = window.__REACT_ERRORS__ || [];

        // Basic performance info
        results.performance = {
          domElements: document.querySelectorAll('*').length,
          reactElements: document.querySelectorAll('[data-reactroot] *').length,
          testIdElements: document.querySelectorAll('[data-testid]').length
        };

        return results;
      }, { includeComponentTree, includeState });

      return {
        content: [
          {
            type: 'text',
            text: `React Native Web App Inspection for ${url}:

🔍 Detection Results:
- React Detected: ${inspection.reactDetected ? '✅' : '❌'}
- Expo Detected: ${inspection.expoDetected ? '✅' : '❌'}

📊 Element Analysis:
- Total DOM Elements: ${inspection.performance.domElements}
- React Elements: ${inspection.performance.reactElements}
- Elements with testID: ${inspection.performance.testIdElements}

🎯 React Native Elements Found: ${inspection.reactNativeElements.length}
${inspection.reactNativeElements.slice(0, 10).map(el => 
  `- ${el.tagName.toUpperCase()}${el.testId ? ` (testId: ${el.testId})` : ''}${el.accessibilityLabel ? ` (label: ${el.accessibilityLabel})` : ''}: "${el.text}"`
).join('\n')}

${includeComponentTree && inspection.componentTree ? `
🌳 Component Tree Structure:
${JSON.stringify(inspection.componentTree, null, 2)}
` : ''}

${inspection.errors.length > 0 ? `
❌ Errors Detected:
${inspection.errors.join('\n')}
` : '✅ No errors detected'}`
          }
        ]
      };
    } finally {
      await context.close();
      await browser.close();
    }
  }

  async waitForReactState(args) {
    this.validateArgs(args, ['url', 'condition']);
    const { 
      url, 
      condition, 
      selector, 
      timeout = TIMEOUTS.HYDRATION,
      browser: browserType = 'chromium'
    } = args;
    
    const { browser, context } = await this.getBrowser(browserType);
    const page = await context.newPage();
    
    try {
      await this.setupMobileViewport(page);
      await page.goto(url, { waitUntil: 'networkidle' });
      
      const startTime = Date.now();
      let result = '';

      switch (condition) {
        case 'hydration':
          const hydrated = await this.waitForReactHydration(page, timeout);
          result = hydrated ? '✅ React hydration completed' : '❌ React hydration timeout';
          break;
          
        case 'navigation':
          await page.waitForFunction(() => {
            return !document.querySelector('[aria-label*="loading"]') &&
                   !document.querySelector('[data-testid*="loading"]');
          }, { timeout });
          result = '✅ Navigation completed';
          break;
          
        case 'data-loading':
          await page.waitForFunction(() => {
            const loadingElements = document.querySelectorAll(
              '[data-testid*="loading"], [aria-label*="loading"], .loading, .spinner'
            );
            return loadingElements.length === 0;
          }, { timeout });
          result = '✅ Data loading completed';
          break;
          
        case 'animation':
          await page.waitForTimeout(2000);
          result = '✅ Animation wait completed';
          break;
          
        case 'custom':
          if (!selector) throw new Error('Selector required for custom condition');
          const { usedSelector } = await this.findElement(page, selector, timeout);
          result = `✅ Custom condition met: ${usedSelector}`;
          break;
          
        default:
          throw new Error(`Unknown condition: ${condition}`);
      }
      
      const waitTime = Date.now() - startTime;
      
      return {
        content: [{
          type: 'text',
          text: `${result}\nWait time: ${waitTime}ms`
        }]
      };
    } finally {
      await context.close();
      await browser.close();
    }
  }

  async waitForElement(args) {
    this.validateArgs(args, ['url', 'selector']);
    const { url, selector, timeout = TIMEOUTS.DEFAULT, browser: browserType = 'chromium' } = args;
    
    const { browser, context } = await this.getBrowser(browserType);
    const page = await context.newPage();
    
    try {
      await page.goto(url, { waitUntil: 'networkidle' });
      
      const startTime = Date.now();
      const { element, usedSelector } = await this.findElement(page, selector, timeout);
      
      const waitTime = Date.now() - startTime;
      const text = await element.textContent();
      const isVisible = await element.isVisible();
      const testId = await element.getAttribute('data-testid');
      const accessibilityLabel = await element.getAttribute('aria-label');

      return {
        content: [{
          type: 'text',
          text: `✅ Element found: ${usedSelector}
Wait time: ${waitTime}ms
Visible: ${isVisible}
Text content: "${text?.trim()}"${testId ? `\nTestID: ${testId}` : ''}${accessibilityLabel ? `\nAccessibility Label: ${accessibilityLabel}` : ''}`
        }]
      };
    } finally {
      await context.close();
      await browser.close();
    }
  }

  async executeInReactContext(args) {
    const { 
      url, 
      script, 
      waitForReact = true,
      browser: browserType = 'chromium'
    } = args;
    
    const { browser, context } = await this.getBrowser(browserType);
    const page = await context.newPage();
    
    try {
      await this.setupMobileViewport(page);
      
      // Set up console error capture before navigation
      const consoleErrors = [];
      const pageErrors = [];
      
      page.on('console', msg => {
        if (msg.type() === 'error') {
          consoleErrors.push({
            type: 'console.error',
            text: msg.text(),
            location: msg.location(),
            timestamp: Date.now()
          });
        }
      });
      
      page.on('pageerror', error => {
        pageErrors.push({
          type: 'page_error',
          message: error.message,
          stack: error.stack,
          timestamp: Date.now()
        });
      });
      
      await page.goto(url, { waitUntil: 'networkidle' });
      
      if (waitForReact) {
        await this.waitForReactHydration(page);
      }

      const result = await page.evaluate((userScript) => {
        try {
          // Set up window error capture
          window.__capturedErrors = window.__capturedErrors || [];
          
          const originalError = console.error;
          console.error = function(...args) {
            window.__capturedErrors.push({
              type: 'console.error',
              message: args.join(' '),
              timestamp: Date.now(),
              stack: new Error().stack
            });
            originalError.apply(console, arguments);
          };
          
          // Execute the script as a function body, not an expression
          const scriptFunction = new Function(userScript);
          const result = scriptFunction();
          
          return {
            success: true,
            result: result,
            reactAvailable: !!(window.React || window.__REACT_DEVTOOLS_GLOBAL_HOOK__),
            expoAvailable: !!(window.expo || window.__EXPO_WEB__),
            capturedErrors: window.__capturedErrors || []
          };
        } catch (error) {
          return {
            success: false,
            error: error.message,
            stack: error.stack,
            reactAvailable: !!(window.React || window.__REACT_DEVTOOLS_GLOBAL_HOOK__),
            expoAvailable: !!(window.expo || window.__EXPO_WEB__),
            capturedErrors: window.__capturedErrors || []
          };
        }
      }, script);
      
      // Wait a moment for any async errors to be captured
      await page.waitForTimeout(1000);
      
      // Get any additional errors that might have been captured
      const additionalErrors = await page.evaluate(() => {
        return window.__capturedErrors || [];
      });

      const allErrors = [
        ...consoleErrors,
        ...pageErrors,
        ...result.capturedErrors,
        ...additionalErrors
      ];

      return {
        content: [
          {
            type: 'text',
            text: `JavaScript Execution Result:

${result.success ? '✅ Success' : '❌ Error'}
React Available: ${result.reactAvailable ? '✅' : '❌'}
Expo Available: ${result.expoAvailable ? '✅' : '❌'}

${result.success 
  ? `Result: ${result.result !== undefined ? JSON.stringify(result.result, null, 2) : 'undefined'}`
  : `Error: ${result.error}${result.stack ? '\nStack: ' + result.stack : ''}`
}

${allErrors.length > 0 ? `
🚨 Captured Errors (${allErrors.length}):
${allErrors.map(err => `- [${err.type}] ${err.message || err.text}${err.location ? ` at ${err.location.url}:${err.location.lineNumber}` : ''}`).join('\n')}
` : '✅ No errors captured'}`
          }
        ]
      };
    } finally {
      await context.close();
      await browser.close();
    }
  }

  async checkExpoDevServer(args) {
    const { port = 8081, host = 'localhost' } = args;
    
    try {
      const { browser, context } = await this.getBrowser('chromium');
      const page = await context.newPage();
      
      try {
        // Check if Metro bundler is running
        const metroUrl = `http://${host}:${port}`;
        await page.goto(metroUrl, { timeout: 5000 });
        
        const pageContent = await page.textContent('body');
        const isMetro = pageContent.includes('Metro') || pageContent.includes('React Native');
        
        // Check for common Expo endpoints
        const endpoints = [
          `${metroUrl}/status`,
          `${metroUrl}/symbolicate`,
          `${metroUrl}/assets`
        ];
        
        const endpointResults = [];
        for (const endpoint of endpoints) {
          try {
            const response = await page.goto(endpoint, { timeout: 3000 });
            endpointResults.push({
              url: endpoint,
              status: response.status(),
              available: response.ok()
            });
          } catch (e) {
            endpointResults.push({
              url: endpoint,
              status: 'timeout',
              available: false
            });
          }
        }
        
        return {
          content: [
            {
              type: 'text',
              text: `Expo Development Server Status:

🌐 Metro Bundler: ${isMetro ? '✅ Running' : '❌ Not detected'} at ${metroUrl}

📡 Endpoint Status:
${endpointResults.map(ep => 
  `- ${ep.url}: ${ep.available ? '✅' : '❌'} (${ep.status})`
).join('\n')}

${isMetro ? '✅ Expo dev server appears to be running correctly' : '❌ Expo dev server may not be running or accessible'}`
            }
          ]
        };
      } finally {
        await context.close();
        await browser.close();
      }
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ Failed to check Expo dev server: ${error.message}

This usually means:
- Metro bundler is not running on port ${port}
- Expo development server is not started
- Network connectivity issues

Try running: npx expo start --web`
          }
        ]
      };
    }
  }

  async getPageInfo(args) {
    const { url, browser: browserType = 'chromium', includePerformance } = args;
    
    const { browser, context } = await this.getBrowser(browserType);
    const page = await context.newPage();
    
    try {
      const startTime = Date.now();
      await page.goto(url, { waitUntil: 'networkidle' });
      const loadTime = Date.now() - startTime;

      const info = await page.evaluate(() => ({
        title: document.title,
        url: window.location.href,
        metaTags: Array.from(document.querySelectorAll('meta')).map(meta => ({
          name: meta.name || meta.property,
          content: meta.content
        })).filter(meta => meta.name),
        headings: Array.from(document.querySelectorAll('h1, h2, h3')).map(h => ({
          tag: h.tagName.toLowerCase(),
          text: h.textContent.trim()
        })),
        links: Array.from(document.querySelectorAll('a[href]')).length,
        images: Array.from(document.querySelectorAll('img')).length,
        forms: Array.from(document.querySelectorAll('form')).length,
        // React Native web specific elements
        reactNativeElements: {
          testIds: Array.from(document.querySelectorAll('[data-testid]')).length,
          accessibilityLabels: Array.from(document.querySelectorAll('[aria-label]')).length,
          touchableElements: Array.from(document.querySelectorAll('[role="button"], button, [onclick]')).length
        },
        // Framework detection
        frameworks: {
          react: !!(window.React || window.__REACT_DEVTOOLS_GLOBAL_HOOK__),
          expo: !!(window.expo || window.__EXPO_WEB__ || document.querySelector('.expo-web-view')),
          reactNativeWeb: !!document.querySelector('[data-reactroot] [style*="flex"]')
        }
      }));

      let performanceInfo = '';
      if (includePerformance) {
        const metrics = await page.evaluate(() => {
          const perf = performance.getEntriesByType('navigation')[0];
          return {
            domContentLoaded: perf.domContentLoadedEventEnd - perf.domContentLoadedEventStart,
            loadComplete: perf.loadEventEnd - perf.loadEventStart,
            firstPaint: performance.getEntriesByType('paint').find(p => p.name === 'first-paint')?.startTime,
            firstContentfulPaint: performance.getEntriesByType('paint').find(p => p.name === 'first-contentful-paint')?.startTime
          };
        });
        
        performanceInfo = `\n\nPerformance Metrics:
- Page Load Time: ${loadTime}ms
- DOM Content Loaded: ${metrics.domContentLoaded}ms
- Load Complete: ${metrics.loadComplete}ms
- First Paint: ${metrics.firstPaint || 'N/A'}ms
- First Contentful Paint: ${metrics.firstContentfulPaint || 'N/A'}ms`;
      }

      return {
        content: [
          {
            type: 'text',
            text: `Page Information for ${url}:

Title: ${info.title}
URL: ${info.url}

🔍 Framework Detection:
- React: ${info.frameworks.react ? '✅' : '❌'}
- Expo: ${info.frameworks.expo ? '✅' : '❌'}
- React Native Web: ${info.frameworks.reactNativeWeb ? '✅' : '❌'}

Meta Tags:
${info.metaTags.map(meta => `- ${meta.name}: ${meta.content}`).join('\n')}

Headings:
${info.headings.map(h => `- ${h.tag.toUpperCase()}: ${h.text}`).join('\n')}

Page Elements:
- Links: ${info.links}
- Images: ${info.images}
- Forms: ${info.forms}

📱 React Native Web Elements:
- Elements with testID: ${info.reactNativeElements.testIds}
- Elements with accessibility labels: ${info.reactNativeElements.accessibilityLabels}
- Touchable elements: ${info.reactNativeElements.touchableElements}${performanceInfo}`
          }
        ]
      };
    } finally {
      await context.close();
      await browser.close();
    }
  }

  async testReactApp(args) {
    this.validateArgs(args, ['url', 'actions']);
    const { 
      url, 
      actions, 
      browser: browserType = 'chromium',
      device,
      waitForHydration = true
    } = args;
    
    const { browser, context } = await this.getBrowser(browserType, device);
    const page = await context.newPage();
    const results = [];
    
    try {
      if (!device) {
        await this.setupMobileViewport(page);
      }

      await page.goto(url, { waitUntil: 'networkidle' });
      results.push(`✅ Navigated to ${url}`);

      if (waitForHydration) {
        const hydrated = await this.waitForReactHydration(page);
        results.push(hydrated ? '✅ React hydration completed' : '⚠️ React hydration timeout');
      }

      for (const action of actions) {
        const { type, selector, value, timeout = TIMEOUTS.DEFAULT, coordinates } = action;
        
        try {
          switch (type) {
            case 'click':
            case 'tap':
              await this.performClick(page, selector, timeout);
              results.push(`✅ ${type === 'tap' ? 'Tapped' : 'Clicked'}: ${selector}`);
              break;
              
            case 'fill':
              await this.performFill(page, selector, value, timeout);
              results.push(`✅ Filled "${value}" into: ${selector}`);
              break;
              
            case 'wait':
              await this.performWait(page, selector, timeout);
              results.push(`✅ Waited for: ${selector}`);
              break;
              
            case 'screenshot':
              const screenshotBuffer = await page.screenshot({ fullPage: true });
              const screenshotPath = `/tmp/react-test-${Date.now()}.png`;
              fs.writeFileSync(screenshotPath, screenshotBuffer);
              results.push(`✅ Screenshot saved: ${screenshotPath}`);
              break;
              
            case 'getText':
              const text = await this.getElementText(page, selector, timeout);
              results.push(`✅ Text from ${selector}: "${text}"`);
              break;
              
            case 'getAttribute':
              const attr = await this.getElementAttribute(page, selector, value, timeout);
              results.push(`✅ Attribute "${value}" from ${selector}: "${attr}"`);
              break;

            case 'swipe':
              await this.performSwipe(page, selector, value, coordinates, timeout);
              results.push(`✅ Swiped ${value} on: ${selector}`);
              break;

            case 'scroll':
              await this.performScroll(page, selector, value, timeout);
              results.push(`✅ Scrolled ${value} on: ${selector}`);
              break;

            case 'longPress':
              await this.performLongPress(page, selector, timeout);
              results.push(`✅ Long pressed: ${selector}`);
              break;

            case 'waitForNavigation':
              await page.waitForLoadState('networkidle', { timeout });
              results.push(`✅ Navigation completed`);
              break;
              
            default:
              results.push(`❌ Unknown action type: ${type}`);
          }
        } catch (actionError) {
          results.push(`❌ Failed ${type} on ${selector}: ${actionError.message}`);
        }
      }

      return {
        content: [{
          type: 'text',
          text: `React Native Web App Test Results:\n\n${results.join('\n')}`
        }]
      };
    } finally {
      await context.close();
      await browser.close();
    }
  }

  // Helper methods for React app interactions
  async performClick(page, selector, timeout) {
    const { element } = await this.findElement(page, selector, timeout);
    await element.click();
  }

  async performFill(page, selector, value, timeout) {
    const { element } = await this.findElement(page, selector, timeout);
    await element.fill(value);
  }

  async performWait(page, selector, timeout) {
    await this.findElement(page, selector, timeout);
  }

  async getElementText(page, selector, timeout) {
    const { element } = await this.findElement(page, selector, timeout);
    return await element.textContent();
  }

  async getElementAttribute(page, selector, attribute, timeout) {
    const { element } = await this.findElement(page, selector, timeout);
    return await element.getAttribute(attribute);
  }

  async performSwipe(page, selector, direction, coordinates, timeout) {
    if (coordinates) {
      // Swipe from coordinates
      const { x, y } = coordinates;
      const endX = direction === 'left' ? x - 100 : direction === 'right' ? x + 100 : x;
      const endY = direction === 'up' ? y - 100 : direction === 'down' ? y + 100 : y;
      
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(endX, endY);
      await page.mouse.up();
    } else {
      // Swipe on element
      const element = await page.waitForSelector(selector, { timeout });
      const box = await element.boundingBox();
      
      const startX = box.x + box.width / 2;
      const startY = box.y + box.height / 2;
      const endX = direction === 'left' ? startX - 100 : direction === 'right' ? startX + 100 : startX;
      const endY = direction === 'up' ? startY - 100 : direction === 'down' ? startY + 100 : startY;
      
      await page.mouse.move(startX, startY);
      await page.mouse.down();
      await page.mouse.move(endX, endY);
      await page.mouse.up();
    }
  }

  async performScroll(page, selector, direction, timeout) {
    const element = await page.waitForSelector(selector, { timeout });
    const scrollAmount = direction === 'up' ? -300 : 300;
    
    await element.evaluate((el, amount) => {
      el.scrollBy(0, amount);
    }, scrollAmount);
  }

  async performLongPress(page, selector, timeout) {
    const element = await page.waitForSelector(selector, { timeout });
    const box = await element.boundingBox();
    
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(1000); // Hold for 1 second
    await page.mouse.up();
  }

  async testDropdownWithErrorCapture(args) {
    const { 
      url, 
      dropdownSelector,
      waitAfterClick = 3000,
      browser: browserType = 'chromium',
      takeScreenshots = true
    } = args;
    
    const { browser, context } = await this.getBrowser(browserType);
    const page = await context.newPage();
    
    const consoleErrors = [];
    const pageErrors = [];
    const networkErrors = [];
    
    try {
      await this.setupMobileViewport(page);
      
      // Set up comprehensive error capture
      page.on('console', msg => {
        if (msg.type() === 'error') {
          consoleErrors.push({
            type: 'console.error',
            text: msg.text(),
            location: msg.location(),
            timestamp: Date.now()
          });
        }
      });
      
      page.on('pageerror', error => {
        pageErrors.push({
          type: 'page_error',
          message: error.message,
          stack: error.stack,
          timestamp: Date.now()
        });
      });
      
      page.on('requestfailed', request => {
        networkErrors.push({
          type: 'network_error',
          url: request.url(),
          failure: request.failure()?.errorText,
          timestamp: Date.now()
        });
      });

      await page.goto(url, { waitUntil: 'networkidle' });
      await this.waitForReactHydration(page);
      
      // Take before screenshot
      let beforeScreenshot = '';
      if (takeScreenshots) {
        const beforeBuffer = await page.screenshot({ fullPage: true });
        beforeScreenshot = `/tmp/dropdown-before-${Date.now()}.png`;
        fs.writeFileSync(beforeScreenshot, beforeBuffer);
      }
      
      // Set up additional error capture in the page context
      await page.evaluate(() => {
        window.__dropdownTestErrors = [];
        
        const originalError = console.error;
        console.error = function(...args) {
          window.__dropdownTestErrors.push({
            type: 'console.error',
            message: args.join(' '),
            timestamp: Date.now(),
            stack: new Error().stack
          });
          originalError.apply(console, arguments);
        };
        
        window.addEventListener('error', function(e) {
          window.__dropdownTestErrors.push({
            type: 'window_error',
            message: e.message,
            filename: e.filename,
            lineno: e.lineno,
            colno: e.colno,
            stack: e.error?.stack,
            timestamp: Date.now()
          });
        });
        
        window.addEventListener('unhandledrejection', function(e) {
          window.__dropdownTestErrors.push({
            type: 'unhandled_rejection',
            message: e.reason?.toString() || 'Unknown rejection',
            timestamp: Date.now()
          });
        });
      });
      
      // Find and click the dropdown
      let clickResult = '';
      let dropdownFound = false;
      
      // Try multiple selector strategies
      const selectors = [
        dropdownSelector,
        `[data-testid="${dropdownSelector}"]`,
        `[aria-label="${dropdownSelector}"]`,
        `button:has-text("${dropdownSelector}")`,
        `*:has-text("${dropdownSelector}")`
      ];
      
      for (const selector of selectors) {
        try {
          const element = await page.$(selector);
          if (element) {
            const isVisible = await element.isVisible();
            const text = await element.textContent();
            
            if (isVisible) {
              await element.click();
              dropdownFound = true;
              clickResult = `✅ Clicked dropdown: ${selector} (text: "${text?.trim()}")`;
              break;
            }
          }
        } catch (e) {
          continue;
        }
      }
      
      if (!dropdownFound) {
        clickResult = `❌ Dropdown not found with selector: ${dropdownSelector}`;
      }
      
      // Wait for errors to manifest
      await page.waitForTimeout(waitAfterClick);
      
      // Check if page went blank
      const bodyContent = await page.textContent('body');
      const isPageBlank = bodyContent.trim().length < 100;
      
      // Get errors captured in page context
      const pageContextErrors = await page.evaluate(() => {
        return window.__dropdownTestErrors || [];
      });
      
      // Take after screenshot
      let afterScreenshot = '';
      if (takeScreenshots) {
        const afterBuffer = await page.screenshot({ fullPage: true });
        afterScreenshot = `/tmp/dropdown-after-${Date.now()}.png`;
        fs.writeFileSync(afterBuffer, afterBuffer);
      }
      
      // Collect all errors
      const allErrors = [
        ...consoleErrors,
        ...pageErrors,
        ...networkErrors,
        ...pageContextErrors
      ];
      
      // Get page state info
      const pageState = await page.evaluate(() => {
        return {
          url: window.location.href,
          title: document.title,
          bodyLength: document.body.innerHTML.length,
          hasReact: !!(window.React || window.__REACT_DEVTOOLS_GLOBAL_HOOK__),
          hasExpo: !!(window.expo || window.__EXPO_WEB__),
          visibleElements: document.querySelectorAll('*:not([style*="display: none"])').length
        };
      });

      return {
        content: [
          {
            type: 'text',
            text: `Dropdown Test Results for ${url}:

🎯 Dropdown Interaction:
${clickResult}

📄 Page State After Click:
- Page Blank: ${isPageBlank ? '❌ YES' : '✅ NO'}
- Body Content Length: ${bodyContent.length} characters
- Visible Elements: ${pageState.visibleElements}
- Current URL: ${pageState.url}
- Page Title: ${pageState.title}

🔍 Framework Detection:
- React Available: ${pageState.hasReact ? '✅' : '❌'}
- Expo Available: ${pageState.hasExpo ? '✅' : '❌'}

${allErrors.length > 0 ? `
🚨 ERRORS CAPTURED (${allErrors.length}):
${allErrors.map((err, i) => `
${i + 1}. [${err.type.toUpperCase()}] ${err.message || err.text}
   ${err.location ? `Location: ${err.location.url}:${err.location.lineNumber}:${err.location.columnNumber}` : ''}
   ${err.stack ? `Stack: ${err.stack.split('\n')[1]?.trim()}` : ''}
   Time: ${new Date(err.timestamp).toISOString()}
`).join('')}
` : '✅ No errors captured'}

${takeScreenshots ? `
📸 Screenshots:
- Before: ${beforeScreenshot}
- After: ${afterScreenshot}
` : ''}`
          }
        ]
      };
    } finally {
      await context.close();
      await browser.close();
    }
  }

  async extractContent(args) {
    this.validateArgs(args, ['url']);
    const { url, includeLinks = true, format = 'markdown', browser: browserType = 'chromium' } = args;

    const { browser, context } = await this.getBrowser(browserType);
    const page = await context.newPage();

    try {
      await page.goto(url, { waitUntil: 'networkidle' });
      
      // Wait for React hydration for SPA sites
      await this.waitForReactHydration(page);

      const content = await page.evaluate(({ includeLinks, format }) => {
        // Remove non-content elements
        const removeSelectors = [
          'nav', 'header', 'footer', 'aside', '.sidebar', '.navigation',
          '.menu', '.ads', '.advertisement', '.social', '.share',
          'script', 'style', 'noscript', '.cookie', '.popup'
        ];
        
        removeSelectors.forEach(sel => {
          document.querySelectorAll(sel).forEach(el => el.remove());
        });

        const result = { content: '', links: [] };
        let linkCounter = 1;
        const linkMap = new Map();

        const categorizeLink = (href, baseUrl) => {
          try {
            const url = new URL(href, baseUrl);
            const base = new URL(baseUrl);
            
            if (url.hostname === base.hostname) return 'internal';
            if (href.startsWith('#')) return 'anchor';
            if (href.match(/\.(pdf|doc|docx|zip|tar|gz)$/i)) return 'download';
            return 'external';
          } catch {
            return 'invalid';
          }
        };

        const processElement = (element) => {
          let text = '';

          switch (element.tagName.toLowerCase()) {
            case 'h1':
              text += format === 'markdown' ? `# ${element.textContent.trim()}\n\n` : `${element.textContent.trim()}\n${'='.repeat(element.textContent.trim().length)}\n\n`;
              break;
            case 'h2':
              text += format === 'markdown' ? `## ${element.textContent.trim()}\n\n` : `${element.textContent.trim()}\n${'-'.repeat(element.textContent.trim().length)}\n\n`;
              break;
            case 'h3':
            case 'h4':
            case 'h5':
            case 'h6':
              const hLevel = parseInt(element.tagName[1]);
              text += format === 'markdown' ? `${'#'.repeat(hLevel)} ${element.textContent.trim()}\n\n` : `${element.textContent.trim()}\n\n`;
              break;
            case 'p':
              let pText = element.textContent.trim();
              if (includeLinks) {
                const links = element.querySelectorAll('a[href]');
                links.forEach(link => {
                  const href = link.getAttribute('href');
                  const linkText = link.textContent.trim();
                  if (href && linkText && !linkMap.has(href)) {
                    linkMap.set(href, {
                      id: linkCounter,
                      text: linkText,
                      url: href,
                      type: categorizeLink(href, window.location.href)
                    });
                    result.links.push(linkMap.get(href));
                    linkCounter++;
                  }
                  if (linkMap.has(href)) {
                    pText = pText.replace(linkText, `${linkText} [${linkMap.get(href).id}]`);
                  }
                });
              }
              text += `${pText}\n\n`;
              break;
            case 'ul':
            case 'ol':
              const items = element.querySelectorAll('li');
              items.forEach((item, i) => {
                const bullet = element.tagName.toLowerCase() === 'ul' ? '-' : `${i + 1}.`;
                text += `${bullet} ${item.textContent.trim()}\n`;
              });
              text += '\n';
              break;
            case 'pre':
              text += format === 'markdown' ? `\`\`\`\n${element.textContent.trim()}\n\`\`\`\n\n` : `${element.textContent.trim()}\n\n`;
              break;
            case 'code':
              text += format === 'markdown' ? `\`${element.textContent.trim()}\`` : element.textContent.trim();
              break;
            case 'blockquote':
              text += format === 'markdown' ? `> ${element.textContent.trim()}\n\n` : `"${element.textContent.trim()}"\n\n`;
              break;
          }
          return text;
        };

        // Process main content elements
        const contentElements = document.querySelectorAll('h1, h2, h3, h4, h5, h6, p, ul, ol, pre, code, blockquote');
        contentElements.forEach(el => {
          result.content += processElement(el);
        });

        return result;
      }, { includeLinks, format });

      let output = content.content;

      if (includeLinks && content.links.length > 0) {
        output += '\n---\n## Links Found:\n';
        content.links.forEach(link => {
          output += `[${link.id}] ${link.url} (${link.type})\n`;
        });
      }

      return {
        content: [{
          type: 'text',
          text: `Content extracted from ${url}:\n\n${output}`
        }]
      };
    } finally {
      await context.close();
      await browser.close();
    }
  }

  async isSPA(page) {
    // Runtime detection of SPA frameworks
    return await page.evaluate(() => {
      return !!(
        window.React ||
        window.Vue ||
        window.angular ||
        window.ng ||
        window.__REACT_DEVTOOLS_GLOBAL_HOOK__ ||
        document.querySelector('[data-reactroot]') ||
        document.querySelector('#root') ||
        document.querySelector('#app') ||
        document.querySelector('[ng-version]') ||
        document.querySelector('[data-vue-app]') ||
        document.querySelector('script[src*="react"]') ||
        document.querySelector('script[src*="vue"]') ||
        document.querySelector('script[src*="angular"]') ||
        document.querySelector('meta[name="generator"][content*="React"]') ||
        document.querySelector('meta[name="generator"][content*="Vue"]') ||
        document.querySelector('meta[name="generator"][content*="Angular"]')
      );
    });
  }

  async waitForSPAReady(page, timeout = 10000) {
    try {
      // Wait for common frameworks
      await page.waitForFunction(() => {
        return window.React || 
               window.Vue || 
               window.angular || 
               window.ng ||
               document.querySelector('[data-reactroot]') ||
               document.querySelector('#root') ||
               document.querySelector('#app') ||
               document.querySelector('.vue-app') ||
               document.querySelector('[ng-version]');
      }, { timeout: 5000 });

      // Wait for loading indicators to disappear
      const loadingSelectors = [
        '[data-testid*="loading"]',
        '[data-testid*="spinner"]',
        '.loading', '.spinner', '.loader',
        '[aria-label*="loading"]',
        '[class*="loading"]',
        '[class*="spinner"]'
      ];

      for (const selector of loadingSelectors) {
        try {
          await page.waitForSelector(selector, { state: 'detached', timeout: 2000 });
        } catch (e) {
          // Selector not found or didn't disappear - continue
        }
      }

      // Additional wait for content to stabilize
      await page.waitForTimeout(1000);
      
    } catch (e) {
      // Fallback: just wait a bit longer
      await page.waitForTimeout(3000);
    }
  }

  async takeScreenshot(args) {
    this.validateArgs(args, ['url']);
    const { url, browser: browserType = 'chromium', device, fullPage = true, waitForSPA = true } = args;

    const { browser, context } = await this.getBrowser(browserType, device);
    const page = await context.newPage();

    try {
      await page.goto(url, { waitUntil: 'networkidle' });
      
      if (waitForSPA && await this.isSPA(page)) {
        await this.waitForSPAReady(page);
      } else if (url.includes('expo') || url.includes(':8081')) {
        await this.waitForReactHydration(page);
      }

      const screenshot = await page.screenshot({ 
        fullPage,
        type: 'png'
      });

      // Save screenshot to file for reference
      const screenshotPath = `/tmp/screenshot-${Date.now()}.png`;
      fs.writeFileSync(screenshotPath, screenshot);

      // Get basic page analysis
      const pageAnalysis = await page.evaluate(() => {
        const body = document.body;
        const visibleElements = Array.from(document.querySelectorAll('*')).filter(el => {
          const style = window.getComputedStyle(el);
          return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
        });

        return {
          title: document.title,
          bodyText: body.textContent?.trim().substring(0, 500) + '...',
          visibleElementCount: visibleElements.length,
          hasContent: body.textContent?.trim().length > 100,
          mainElements: {
            headings: document.querySelectorAll('h1, h2, h3, h4, h5, h6').length,
            paragraphs: document.querySelectorAll('p').length,
            buttons: document.querySelectorAll('button').length,
            inputs: document.querySelectorAll('input').length,
            tables: document.querySelectorAll('table').length,
            lists: document.querySelectorAll('ul, ol').length
          }
        };
      });

      return {
        content: [
          {
            type: 'text',
            text: `Screenshot captured from ${url}

📸 Screenshot saved to: ${screenshotPath}

📄 Page Analysis:
- Title: ${pageAnalysis.title}
- Has Content: ${pageAnalysis.hasContent ? '✅' : '❌'}
- Visible Elements: ${pageAnalysis.visibleElementCount}

📊 Content Elements:
- Headings: ${pageAnalysis.mainElements.headings}
- Paragraphs: ${pageAnalysis.mainElements.paragraphs}
- Buttons: ${pageAnalysis.mainElements.buttons}
- Inputs: ${pageAnalysis.mainElements.inputs}
- Tables: ${pageAnalysis.mainElements.tables}
- Lists: ${pageAnalysis.mainElements.lists}

📝 Page Content Preview:
${pageAnalysis.bodyText}`
          }
        ],
        screenshotPath: screenshotPath
      };
    } finally {
      await context.close();
      await browser.close();
    }
  }

  async compareScreenshots(args) {
    this.validateArgs(args, ['urlA', 'urlB']);
    const { 
      urlA, 
      urlB, 
      browser: browserType = 'chromium', 
      threshold = 0.1,
      analyzeLayout = true,
      analyzeColors = true,
      analyzeTypography = true,
      waitForSPA = true
    } = args;

    const { browser, context } = await this.getBrowser(browserType);
    
    try {
      // Take screenshots
      const [pageA, pageB] = await Promise.all([
        context.newPage(),
        context.newPage()
      ]);

      await Promise.all([
        pageA.goto(urlA, { waitUntil: 'networkidle' }),
        pageB.goto(urlB, { waitUntil: 'networkidle' })
      ]);

      // Wait for SPAs to be ready
      if (waitForSPA) {
        const waitPromises = [];
        if (await this.isSPA(pageA)) waitPromises.push(this.waitForSPAReady(pageA));
        if (await this.isSPA(pageB)) waitPromises.push(this.waitForSPAReady(pageB));
        await Promise.all(waitPromises);
      } else {
        // Fallback to existing React hydration logic
        if (urlA.includes('expo') || urlA.includes(':8081')) {
          await this.waitForReactHydration(pageA);
        }
        if (urlB.includes('expo') || urlB.includes(':8081')) {
          await this.waitForReactHydration(pageB);
        }
      }

      const [screenshotA, screenshotB] = await Promise.all([
        pageA.screenshot({ fullPage: true, type: 'png' }),
        pageB.screenshot({ fullPage: true, type: 'png' })
      ]);

      // Save screenshots for reference
      const timestampA = Date.now();
      const timestampB = timestampA + 1;
      const pathA = `/tmp/compare-source-${timestampA}.png`;
      const pathB = `/tmp/compare-target-${timestampB}.png`;
      
      fs.writeFileSync(pathA, screenshotA);
      fs.writeFileSync(pathB, screenshotB);

      // Get page content analysis for both pages
      const [analysisA, analysisB] = await Promise.all([
        pageA.evaluate(() => ({
          title: document.title,
          bodyText: document.body.textContent?.trim().substring(0, 300),
          visibleElements: Array.from(document.querySelectorAll('*')).filter(el => {
            const style = window.getComputedStyle(el);
            return style.display !== 'none' && style.visibility !== 'hidden';
          }).length,
          mainElements: {
            headings: document.querySelectorAll('h1, h2, h3, h4, h5, h6').length,
            paragraphs: document.querySelectorAll('p').length,
            buttons: document.querySelectorAll('button').length,
            tables: document.querySelectorAll('table').length,
            tableRows: document.querySelectorAll('tr').length
          }
        })),
        pageB.evaluate(() => ({
          title: document.title,
          bodyText: document.body.textContent?.trim().substring(0, 300),
          visibleElements: Array.from(document.querySelectorAll('*')).filter(el => {
            const style = window.getComputedStyle(el);
            return style.display !== 'none' && style.visibility !== 'hidden';
          }).length,
          mainElements: {
            headings: document.querySelectorAll('h1, h2, h3, h4, h5, h6').length,
            paragraphs: document.querySelectorAll('p').length,
            buttons: document.querySelectorAll('button').length,
            tables: document.querySelectorAll('table').length,
            tableRows: document.querySelectorAll('tr').length
          }
        }))
      ]);

      // Analyze images
      const analysis = await this.analyzeVisualDifferences(
        screenshotA, 
        screenshotB, 
        { analyzeLayout, analyzeColors, analyzeTypography, threshold }
      );

      // Content comparison
      const contentComparison = {
        titles: {
          source: analysisA.title,
          target: analysisB.title,
          match: analysisA.title === analysisB.title
        },
        elementCounts: {
          source: analysisA.visibleElements,
          target: analysisB.visibleElements,
          difference: Math.abs(analysisA.visibleElements - analysisB.visibleElements)
        },
        structuralElements: {
          headings: { source: analysisA.mainElements.headings, target: analysisB.mainElements.headings },
          paragraphs: { source: analysisA.mainElements.paragraphs, target: analysisB.mainElements.paragraphs },
          buttons: { source: analysisA.mainElements.buttons, target: analysisB.mainElements.buttons },
          tables: { source: analysisA.mainElements.tables, target: analysisB.mainElements.tables },
          tableRows: { source: analysisA.mainElements.tableRows, target: analysisB.mainElements.tableRows }
        }
      };

      return {
        content: [
          {
            type: 'text',
            text: `Visual comparison between ${urlA} and ${urlB}:

📸 Screenshots saved:
- Source: ${pathA}
- Target: ${pathB}

📊 VISUAL SIMILARITY: ${(analysis.similarity * 100).toFixed(1)}% ${analysis.similar ? '✅ PASS' : '❌ FAIL'}

📄 Content Analysis:
- Source Title: "${contentComparison.titles.source}"
- Target Title: "${contentComparison.titles.target}"
- Titles Match: ${contentComparison.titles.match ? '✅' : '❌'}

📈 Element Counts:
- Source Elements: ${contentComparison.elementCounts.source}
- Target Elements: ${contentComparison.elementCounts.target}
- Difference: ${contentComparison.elementCounts.difference} elements

🏗️ Structural Comparison:
- Headings: ${contentComparison.structuralElements.headings.source} → ${contentComparison.structuralElements.headings.target}
- Paragraphs: ${contentComparison.structuralElements.paragraphs.source} → ${contentComparison.structuralElements.paragraphs.target}
- Buttons: ${contentComparison.structuralElements.buttons.source} → ${contentComparison.structuralElements.buttons.target}
- Tables: ${contentComparison.structuralElements.tables.source} → ${contentComparison.structuralElements.tables.target}
- Table Rows: ${contentComparison.structuralElements.tableRows.source} → ${contentComparison.structuralElements.tableRows.target}

${this.formatAnalysisResults(analysis)}`
          }
        ],
        analysis,
        contentComparison,
        screenshots: { pathA, pathB }
      };
    } finally {
      await context.close();
      await browser.close();
    }
  }

  async analyzeVisualDifferences(imageA, imageB, options) {
    const { analyzeLayout, analyzeColors, analyzeTypography, threshold } = options;
    
    // Convert images to Sharp objects for processing
    const imgA = sharp(imageA);
    const imgB = sharp(imageB);
    
    const [metaA, metaB] = await Promise.all([
      imgA.metadata(),
      imgB.metadata()
    ]);

    const analysis = {
      dimensions: {
        source: { width: metaA.width, height: metaA.height },
        target: { width: metaB.width, height: metaB.height },
        match: metaA.width === metaB.width && metaA.height === metaB.height
      },
      layout: {},
      colors: {},
      typography: {},
      similarity: 0
    };

    // Resize images to same dimensions for comparison
    const minWidth = Math.min(metaA.width, metaB.width);
    const minHeight = Math.min(metaA.height, metaB.height);

    const [bufferA, bufferB] = await Promise.all([
      imgA.resize(minWidth, minHeight).raw().toBuffer(),
      imgB.resize(minWidth, minHeight).raw().toBuffer()
    ]);

    if (analyzeLayout) {
      analysis.layout = await this.analyzeLayout(bufferA, bufferB, minWidth, minHeight);
    }

    if (analyzeColors) {
      analysis.colors = await this.analyzeColors(bufferA, bufferB);
    }

    if (analyzeTypography) {
      analysis.typography = await this.analyzeTypography(bufferA, bufferB, minWidth, minHeight);
    }

    // Calculate overall similarity
    let totalDiff = 0;
    const totalPixels = minWidth * minHeight * 3; // RGB channels
    
    for (let i = 0; i < bufferA.length; i++) {
      totalDiff += Math.abs(bufferA[i] - bufferB[i]);
    }
    
    analysis.similarity = 1 - (totalDiff / (totalPixels * 255));
    analysis.similar = analysis.similarity >= (1 - threshold);

    return analysis;
  }

  async analyzeLayout(bufferA, bufferB, width, height) {
    // Grid-based layout analysis
    const gridSize = 20; // 20x20 grid
    const cellWidth = Math.floor(width / gridSize);
    const cellHeight = Math.floor(height / gridSize);
    
    const layoutDiffs = [];
    
    for (let row = 0; row < gridSize; row++) {
      for (let col = 0; col < gridSize; col++) {
        const cellDiff = this.compareCellContent(
          bufferA, bufferB, 
          col * cellWidth, row * cellHeight, 
          cellWidth, cellHeight, 
          width
        );
        
        if (cellDiff > 0.3) { // Significant difference threshold
          const position = this.getCellPosition(row, col, gridSize);
          layoutDiffs.push({
            region: `${position.vertical}-${position.horizontal}`,
            difference: cellDiff,
            coordinates: { row, col }
          });
        }
      }
    }

    return {
      gridAnalysis: `${layoutDiffs.length} regions with significant layout differences`,
      majorDifferences: layoutDiffs.slice(0, 5), // Top 5 differences
      alignment: this.detectAlignmentDifferences(layoutDiffs)
    };
  }

  compareCellContent(bufferA, bufferB, startX, startY, cellWidth, cellHeight, imageWidth) {
    let totalDiff = 0;
    let pixelCount = 0;
    
    for (let y = startY; y < startY + cellHeight; y++) {
      for (let x = startX; x < startX + cellWidth; x++) {
        const pixelIndex = (y * imageWidth + x) * 3;
        if (pixelIndex + 2 < bufferA.length) {
          totalDiff += Math.abs(bufferA[pixelIndex] - bufferB[pixelIndex]); // R
          totalDiff += Math.abs(bufferA[pixelIndex + 1] - bufferB[pixelIndex + 1]); // G
          totalDiff += Math.abs(bufferA[pixelIndex + 2] - bufferB[pixelIndex + 2]); // B
          pixelCount += 3;
        }
      }
    }
    
    return pixelCount > 0 ? totalDiff / (pixelCount * 255) : 0;
  }

  getCellPosition(row, col, gridSize) {
    const verticalPos = row < gridSize / 3 ? 'top' : 
                      row > (2 * gridSize / 3) ? 'bottom' : 'center';
    const horizontalPos = col < gridSize / 3 ? 'left' : 
                         col > (2 * gridSize / 3) ? 'right' : 'center';
    
    return { vertical: verticalPos, horizontal: horizontalPos };
  }

  detectAlignmentDifferences(layoutDiffs) {
    const regions = layoutDiffs.map(d => d.region);
    const alignmentIssues = [];
    
    if (regions.some(r => r.includes('center-left')) && regions.some(r => r.includes('center-center'))) {
      alignmentIssues.push('Content appears centered in source but left-aligned in target');
    }
    if (regions.some(r => r.includes('center-right')) && regions.some(r => r.includes('center-center'))) {
      alignmentIssues.push('Content appears centered in source but right-aligned in target');
    }
    
    return alignmentIssues;
  }

  async analyzeColors(bufferA, bufferB) {
    const colorDiffs = [];
    const sampleSize = 1000; // Sample 1000 pixels for color analysis
    
    for (let i = 0; i < sampleSize; i++) {
      const pixelIndex = Math.floor(Math.random() * (bufferA.length / 3)) * 3;
      
      const colorA = {
        r: bufferA[pixelIndex],
        g: bufferA[pixelIndex + 1],
        b: bufferA[pixelIndex + 2]
      };
      
      const colorB = {
        r: bufferB[pixelIndex],
        g: bufferB[pixelIndex + 1],
        b: bufferB[pixelIndex + 2]
      };
      
      const diff = Math.sqrt(
        Math.pow(colorA.r - colorB.r, 2) +
        Math.pow(colorA.g - colorB.g, 2) +
        Math.pow(colorA.b - colorB.b, 2)
      );
      
      if (diff > 30) { // Significant color difference
        colorDiffs.push({
          source: `rgb(${colorA.r}, ${colorA.g}, ${colorA.b})`,
          target: `rgb(${colorB.r}, ${colorB.g}, ${colorB.b})`,
          difference: Math.round(diff)
        });
      }
    }

    return {
      significantDifferences: colorDiffs.length,
      examples: colorDiffs.slice(0, 10), // Top 10 color differences
      summary: colorDiffs.length > 50 ? 'Major color palette differences detected' :
               colorDiffs.length > 10 ? 'Moderate color differences detected' :
               'Minor or no color differences detected'
    };
  }

  async analyzeTypography(bufferA, bufferB, width, height) {
    // Text region detection through edge analysis
    const textRegions = this.detectTextRegions(bufferA, bufferB, width, height);
    
    return {
      textRegionsAnalyzed: textRegions.length,
      differences: textRegions.filter(r => r.hasSignificantDifference),
      summary: textRegions.length > 0 ? 
        `Analyzed ${textRegions.length} text regions, ${textRegions.filter(r => r.hasSignificantDifference).length} show typography differences` :
        'No clear text regions detected for typography analysis'
    };
  }

  detectTextRegions(bufferA, bufferB, width, height) {
    // Simplified text detection - look for high contrast areas that might be text
    const regions = [];
    const blockSize = 50; // 50x50 pixel blocks
    
    for (let y = 0; y < height - blockSize; y += blockSize) {
      for (let x = 0; x < width - blockSize; x += blockSize) {
        const contrastA = this.calculateContrast(bufferA, x, y, blockSize, width);
        const contrastB = this.calculateContrast(bufferB, x, y, blockSize, width);
        
        if (contrastA > 0.3 || contrastB > 0.3) { // Likely text region
          const contrastDiff = Math.abs(contrastA - contrastB);
          regions.push({
            x, y, 
            contrastA, 
            contrastB,
            hasSignificantDifference: contrastDiff > 0.1
          });
        }
      }
    }
    
    return regions;
  }

  calculateContrast(buffer, startX, startY, blockSize, imageWidth) {
    let minBrightness = 255;
    let maxBrightness = 0;
    
    for (let y = startY; y < startY + blockSize; y++) {
      for (let x = startX; x < startX + blockSize; x++) {
        const pixelIndex = (y * imageWidth + x) * 3;
        if (pixelIndex + 2 < buffer.length) {
          const brightness = (buffer[pixelIndex] + buffer[pixelIndex + 1] + buffer[pixelIndex + 2]) / 3;
          minBrightness = Math.min(minBrightness, brightness);
          maxBrightness = Math.max(maxBrightness, brightness);
        }
      }
    }
    
    return (maxBrightness - minBrightness) / 255;
  }

  formatAnalysisResults(analysis) {
    let result = `📊 VISUAL COMPARISON RESULTS\n\n`;
    
    // Dimensions
    result += `📐 Dimensions:\n`;
    result += `- Source: ${analysis.dimensions.source.width}x${analysis.dimensions.source.height}\n`;
    result += `- Target: ${analysis.dimensions.target.width}x${analysis.dimensions.target.height}\n`;
    result += `- Match: ${analysis.dimensions.match ? '✅' : '❌'}\n\n`;
    
    // Overall similarity
    result += `🎯 Overall Similarity: ${(analysis.similarity * 100).toFixed(1)}% ${analysis.similar ? '✅' : '❌'}\n\n`;
    
    // Layout analysis
    if (analysis.layout.gridAnalysis) {
      result += `📋 Layout Analysis:\n`;
      result += `- ${analysis.layout.gridAnalysis}\n`;
      if (analysis.layout.alignment.length > 0) {
        result += `- Alignment issues: ${analysis.layout.alignment.join(', ')}\n`;
      }
      result += `\n`;
    }
    
    // Color analysis
    if (analysis.colors.summary) {
      result += `🎨 Color Analysis:\n`;
      result += `- ${analysis.colors.summary}\n`;
      if (analysis.colors.examples.length > 0) {
        result += `- Example differences:\n`;
        analysis.colors.examples.slice(0, 3).forEach(diff => {
          result += `  • ${diff.source} → ${diff.target} (diff: ${diff.difference})\n`;
        });
      }
      result += `\n`;
    }
    
    // Typography analysis
    if (analysis.typography.summary) {
      result += `📝 Typography Analysis:\n`;
      result += `- ${analysis.typography.summary}\n\n`;
    }
    
    return result;
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Web Scraper MCP server running on stdio');
  }
}

export { WebScraperServer };

const server = new WebScraperServer();
server.run().catch(console.error);
