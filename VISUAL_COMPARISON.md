# Visual Screenshot Comparison

This MCP server now includes visual comparison tools for UI replication and testing.

## New Tools

### `take_screenshot`
Captures a screenshot of a webpage without extracting HTML/CSS content.

```json
{
  "url": "https://example.com",
  "browser": "chromium",
  "device": "iPhone 12",
  "fullPage": true
}
```

### `compare_screenshots`
Compares two webpages visually and provides semantic analysis.

```json
{
  "urlA": "https://source-site.com",
  "urlB": "https://target-site.com", 
  "browser": "chromium",
  "threshold": 0.1,
  "analyzeLayout": true,
  "analyzeColors": true,
  "analyzeTypography": true
}
```

## Analysis Features

### Layout Analysis
- **Grid-based comparison**: Divides images into 20x20 grid for region analysis
- **Alignment detection**: Identifies center vs left/right alignment differences
- **Positioning feedback**: Reports layout shifts in semantic terms

### Color Analysis  
- **Exact color matching**: Pixel-level RGB comparison
- **Significant difference detection**: Filters out minor variations
- **Color palette comparison**: Samples colors across the image

### Typography Analysis
- **Text region detection**: Identifies high-contrast areas likely containing text
- **Font weight analysis**: Detects bold/regular text differences through contrast
- **Spacing analysis**: Compares text block spacing and line heights

## Output Format

Returns semantic feedback like:
- "Content appears centered in source but left-aligned in target"
- "Major color palette differences detected"
- "Typography differences in 3 text regions"

## Use Cases

- **UI Replication**: Compare source design with implementation
- **Visual Regression Testing**: Detect unintended changes
- **Cross-browser Consistency**: Ensure consistent rendering
- **Design QA**: Verify pixel-perfect implementations

## Context Efficiency

- **No HTML/CSS extraction**: Only visual analysis
- **Semantic feedback**: Layout language instead of pixel coordinates  
- **Actionable insights**: Clear guidance for developers
