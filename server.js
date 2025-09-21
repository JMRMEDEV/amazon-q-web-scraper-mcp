#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { chromium, firefox, webkit, devices } from 'playwright';
import fs from 'fs';

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
    
    // Error handling
    this.server.onerror = (error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
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
        }
      ]
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      console.error('[DEBUG raw request.params]', JSON.stringify(request.params, null, 2));

      let { name, arguments: args } = request.params;
      console.error('[DEBUG extracted name]', name);
      console.error('[DEBUG extracted args type]', typeof args, 'isArray?', Array.isArray(args));

      try {
        switch (name) {
		  case 'inspect_element': {
		    console.error('[inspect_element] incoming args (pre-call):', (() => {
		      try { return JSON.stringify(args, null, 2); } catch (e) { return String(args); }
		    })());
		    // Normalize in case Q sends args as an array or multiple params
		    let normalized = args;
		    if (Array.isArray(args)) {
		      // If Q sent ["http://...", "#header"]
		      normalized = { url: args[0], selector: args[1] };
		    }
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
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error.message}`
            }
          ],
          isError: true
        };
      }
    });
  }

  async getBrowser(browserType = 'chromium', deviceName = null) {
    const browsers = { chromium, firefox, webkit };
    const browser = await browsers[browserType].launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'] // Better for containerized environments
    });
    
    const context = deviceName && devices[deviceName] 
      ? await browser.newContext(devices[deviceName])
      : await browser.newContext();
      
    return { browser, context };
  }

  async setupMobileViewport(page, deviceName = null) {
    if (deviceName && devices[deviceName]) {
      // Device emulation is handled in context creation
      return;
    }
    
    // Default mobile viewport for React Native web
    await page.setViewportSize({ width: 375, height: 667 });
    await page.setExtraHTTPHeaders({
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1'
    });
  }

  async waitForReactHydration(page, timeout = 15000) {
    try {
      // Wait for React to be available
      await page.waitForFunction(() => {
        return window.React || window.__REACT_DEVTOOLS_GLOBAL_HOOK__ || 
               document.querySelector('[data-reactroot]') ||
               document.querySelector('#root [data-testid]') ||
               document.querySelector('.expo-web-view');
      }, { timeout });

      // Additional wait for hydration to complete
      await page.waitForTimeout(1000);
      
      // Check if there are any loading indicators
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

async inspectElement(args) {
  console.error('[DEBUG inspectElement entry]', JSON.stringify(args, null, 2));
  const { url, selector, properties = [], browser: browserType = 'chromium' } = args || {};

  try {
    console.error('[DEBUG] About to call getBrowser with:', browserType);
    const { browser, context } = await this.getBrowser(browserType);
    console.error('[DEBUG] getBrowser successful, creating page...');
    const page = await context.newPage();
    console.error('[DEBUG] Page created, navigating to:', url);

    try {
      await page.goto(url, { waitUntil: 'networkidle' });
      console.error('[DEBUG] Navigation successful, evaluating...');

      const data = await page.evaluate(({ selector: sel, properties: props }) => {
        const el = document.querySelector(sel);
        if (!el) return { error: `Element ${sel} not found` };

        const styles = window.getComputedStyle(el);
        const selected =
          props && props.length > 0
            ? props.reduce((acc, p) => {
                acc[p] = styles.getPropertyValue(p);
                return acc;
              }, {})
            : Object.fromEntries(
                Array.from(styles).map(p => [p, styles.getPropertyValue(p)])
              );

        return {
          tag: el.tagName,
          id: el.id,
          className: el.className,
          text: el.textContent?.trim(),
          styles: selected
        };
      }, { selector, properties });

      console.error('[DEBUG] Evaluation successful, returning result');
      return {
        content: [
          {
            type: 'text',
            text: `Inspection result for ${selector} on ${url}:\n\n${JSON.stringify(
              data,
              null,
              2
            )}`
          }
        ]
      };
    } finally {
      console.error('[DEBUG] Cleaning up browser resources...');
      await context.close();
      await browser.close();
      console.error('[DEBUG] Browser cleanup complete');
    }
  } catch (error) {
    console.error('[DEBUG] Error in inspectElement:', error.message);
    console.error('[DEBUG] Error stack:', error.stack);
    throw error;
  }
}
  

  async scrapePage(args) {
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
      
      // Only wait for React hydration if explicitly requested or if it's clearly a React Native web app
      if (mobileViewport || device || url.includes('expo') || url.includes(':8081')) {
        await this.waitForReactHydration(page);
      }
      
      // Wait for specific condition if provided
      if (waitFor) {
        if (waitFor.match(/^\d+$/)) {
          await page.waitForTimeout(parseInt(waitFor));
        } else {
          // For regular web pages, try direct selector first, then fallback to React Native strategies
          try {
            await page.waitForSelector(waitFor, { timeout: 8000 });
          } catch (e) {
            // Fallback to React Native web selector strategies
            const selectors = [
              `[data-testid="${waitFor}"]`,
              `[accessibilityLabel="${waitFor}"]`,
              `[aria-label="${waitFor}"]`
            ];
            
            let found = false;
            for (const sel of selectors) {
              try {
                await page.waitForSelector(sel, { timeout: 2000 });
                found = true;
                break;
              } catch (e) {
                continue;
              }
            }
            
            if (!found) {
              throw new Error(`Element not found with any selector strategy: ${waitFor}`);
            }
          }
        }
      }

      let content;
      if (selector) {
        // For regular web pages, try direct selector first
        try {
          const elements = await page.$$(selector);
          if (elements.length > 0) {
            content = await Promise.all(
              elements.map(async (el) => await el.textContent())
            );
          } else {
            throw new Error('No elements found with direct selector');
          }
        } catch (e) {
          // Fallback to React Native web selector strategies
          const selectors = [
            `[data-testid="${selector}"]`,
            `[accessibilityLabel="${selector}"]`,
            `[aria-label="${selector}"]`
          ];
          
          let elements = [];
          for (const sel of selectors) {
            try {
              elements = await page.$$(sel);
              if (elements.length > 0) break;
            } catch (e) {
              continue;
            }
          }
          
          if (elements.length > 0) {
            content = await Promise.all(
              elements.map(async (el) => {
                const text = await el.textContent();
                const tagName = await el.evaluate(el => el.tagName);
                const testId = await el.getAttribute('data-testid');
                const accessibilityLabel = await el.getAttribute('aria-label');
                
                return {
                  text: text?.trim(),
                  tagName,
                  testId,
                  accessibilityLabel
                };
              })
            );
          } else {
            content = 'No elements found with the provided selector';
          }
        }
      } else {
        content = await page.textContent('body');
      }

      const result = {
        content: [
          {
            type: 'text',
            text: `Scraped content from ${url}:\n\n${
              Array.isArray(content) 
                ? content.map(item => typeof item === 'object' 
                    ? `${item.tagName}: "${item.text}" (testId: ${item.testId}, label: ${item.accessibilityLabel})`
                    : item
                  ).join('\n---\n')
                : content
            }`
          }
        ]
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
    const { 
      url, 
      condition, 
      selector, 
      timeout = 15000,
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
          await page.waitForTimeout(2000); // Wait for animations to settle
          result = '✅ Animation wait completed';
          break;
          
        case 'custom':
          if (!selector) throw new Error('Selector required for custom condition');
          
          const selectors = [
            selector,
            `[data-testid="${selector}"]`,
            `[aria-label="${selector}"]`
          ];
          
          let found = false;
          for (const sel of selectors) {
            try {
              await page.waitForSelector(sel, { timeout: timeout / selectors.length });
              found = true;
              result = `✅ Custom condition met: ${sel}`;
              break;
            } catch (e) {
              continue;
            }
          }
          
          if (!found) {
            throw new Error(`Custom condition not met: ${selector}`);
          }
          break;
          
        default:
          throw new Error(`Unknown condition: ${condition}`);
      }
      
      const waitTime = Date.now() - startTime;
      
      return {
        content: [
          {
            type: 'text',
            text: `${result}\nWait time: ${waitTime}ms`
          }
        ]
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
        const { type, selector, value, timeout = 10000, coordinates } = action;
        
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
        content: [
          {
            type: 'text',
            text: `React Native Web App Test Results:\n\n${results.join('\n')}`
          }
        ]
      };
    } finally {
      await context.close();
      await browser.close();
    }
  }

  // Helper methods for React app interactions (works with regular React and React Native web)
  async performClick(page, selector, timeout) {
    // Try direct CSS selector first (for regular web pages)
    try {
      await page.click(selector, { timeout: timeout * 0.7 });
      return;
    } catch (e) {
      // Fallback to React Native web selector strategies
      const selectors = [
        `[data-testid="${selector}"]`,
        `[aria-label="${selector}"]`,
        `[accessibilityLabel="${selector}"]`
      ];
      
      for (const sel of selectors) {
        try {
          await page.click(sel, { timeout: timeout * 0.1 });
          return;
        } catch (e) {
          continue;
        }
      }
    }
    throw new Error(`Element not found with any selector: ${selector}`);
  }

  async performFill(page, selector, value, timeout) {
    // Try direct CSS selector first
    try {
      await page.fill(selector, value, { timeout: timeout * 0.7 });
      return;
    } catch (e) {
      // Fallback to React Native web selector strategies
      const selectors = [
        `[data-testid="${selector}"]`,
        `input[aria-label="${selector}"]`,
        `textarea[aria-label="${selector}"]`
      ];
      
      for (const sel of selectors) {
        try {
          await page.fill(sel, value, { timeout: timeout * 0.1 });
          return;
        } catch (e) {
          continue;
        }
      }
    }
    throw new Error(`Input element not found with any selector: ${selector}`);
  }

  async performWait(page, selector, timeout) {
    // Try direct CSS selector first
    try {
      await page.waitForSelector(selector, { timeout: timeout * 0.7 });
      return;
    } catch (e) {
      // Fallback to React Native web selector strategies
      const selectors = [
        `[data-testid="${selector}"]`,
        `[aria-label="${selector}"]`
      ];
      
      for (const sel of selectors) {
        try {
          await page.waitForSelector(sel, { timeout: timeout * 0.15 });
          return;
        } catch (e) {
          continue;
        }
      }
    }
    throw new Error(`Element not found with any selector: ${selector}`);
  }

  async getElementText(page, selector, timeout) {
    // Try direct CSS selector first
    try {
      const element = await page.waitForSelector(selector, { timeout: timeout * 0.7 });
      return await element.textContent();
    } catch (e) {
      // Fallback to React Native web selector strategies
      const selectors = [
        `[data-testid="${selector}"]`,
        `[aria-label="${selector}"]`
      ];
      
      for (const sel of selectors) {
        try {
          const element = await page.waitForSelector(sel, { timeout: timeout * 0.15 });
          return await element.textContent();
        } catch (e) {
          continue;
        }
      }
    }
    throw new Error(`Element not found with any selector: ${selector}`);
  }

  async getElementAttribute(page, selector, attribute, timeout) {
    // Try direct CSS selector first
    try {
      const element = await page.waitForSelector(selector, { timeout: timeout * 0.7 });
      return await element.getAttribute(attribute);
    } catch (e) {
      // Fallback to React Native web selector strategies
      const selectors = [
        `[data-testid="${selector}"]`,
        `[aria-label="${selector}"]`
      ];
      
      for (const sel of selectors) {
        try {
          const element = await page.waitForSelector(sel, { timeout: timeout * 0.15 });
          return await element.getAttribute(attribute);
        } catch (e) {
          continue;
        }
      }
    }
    throw new Error(`Element not found with any selector: ${selector}`);
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

  async waitForElement(args) {
    const { url, selector, timeout = 10000, browser: browserType = 'chromium' } = args;
    
    const { browser, context } = await this.getBrowser(browserType);
    const page = await context.newPage();
    
    try {
      await page.goto(url, { waitUntil: 'networkidle' });
      
      const startTime = Date.now();
      
      let element = null;
      let usedSelector = '';
      
      // Try direct CSS selector first (for regular web pages)
      try {
        await page.waitForSelector(selector, { timeout: timeout * 0.7 });
        element = await page.$(selector);
        usedSelector = selector;
      } catch (e) {
        // Fallback to React Native web selector strategies
        const selectors = [
          `[data-testid="${selector}"]`,
          `[aria-label="${selector}"]`,
          `[accessibilityLabel="${selector}"]`
        ];
        
        for (const sel of selectors) {
          try {
            await page.waitForSelector(sel, { timeout: timeout * 0.1 });
            element = await page.$(sel);
            usedSelector = sel;
            break;
          } catch (e) {
            continue;
          }
        }
      }
      
      if (!element) {
        throw new Error(`Element not found with any selector: ${selector}`);
      }
      
      const waitTime = Date.now() - startTime;
      const text = await element.textContent();
      const isVisible = await element.isVisible();
      const testId = await element.getAttribute('data-testid');
      const accessibilityLabel = await element.getAttribute('aria-label');

      return {
        content: [
          {
            type: 'text',
            text: `✅ Element found: ${usedSelector}
Wait time: ${waitTime}ms
Visible: ${isVisible}
Text content: "${text?.trim()}"${testId ? `\nTestID: ${testId}` : ''}${accessibilityLabel ? `\nAccessibility Label: ${accessibilityLabel}` : ''}`
          }
        ]
      };
    } finally {
      await context.close();
      await browser.close();
    }
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Web Scraper MCP server running on stdio');
  }
}

const server = new WebScraperServer();
server.run().catch(console.error);
