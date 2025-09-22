#!/usr/bin/env node

import { WebScraperServer } from './server.js';

// Simple test for the visual comparison tools
async function testVisualTools() {
  const server = new WebScraperServer();
  
  try {
    console.log('Testing takeScreenshot...');
    const screenshotResult = await server.takeScreenshot({
      url: 'https://example.com'
    });
    console.log('✅ Screenshot tool works');
    
    console.log('Testing compareScreenshots...');
    const comparisonResult = await server.compareScreenshots({
      urlA: 'https://example.com',
      urlB: 'https://httpbin.org/html'
    });
    console.log('✅ Comparison tool works');
    console.log('Analysis preview:', comparisonResult.analysis.similarity);
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Only run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testVisualTools();
}
