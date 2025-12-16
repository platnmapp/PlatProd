# Figma Integration Guide

## Best Practices for Ensuring Figma Design Accuracy

### 1. **Always Use Figma MCP Tools**
When implementing a design from Figma, always use the Figma MCP tools to get:
- Exact design specifications
- Asset URLs for images/logos
- Precise measurements and spacing
- Color codes and typography

### 2. **Workflow for Implementing Figma Designs**

#### Step 1: Get Design Context
```typescript
// Use mcp_Figma_get_design_context to get:
// - Component structure
// - Exact measurements (pixels)
// - Color codes
// - Typography specs
// - Asset URLs
```

#### Step 2: Download Assets
- Extract asset URLs from the Figma response
- Download images/logos to `assets/images/` directory
- Use local assets in production (remote URIs are temporary)

#### Step 3: Convert to React Native
- Convert Tailwind classes to NativeWind
- Convert web React to React Native components
- Use exact pixel values from Figma
- Match colors exactly (#hex codes)

#### Step 4: Verify Layout
- Use `items-center` for horizontal centering
- Use flexbox for responsive layouts
- Match spacing (gaps, padding, margins) exactly
- Verify typography (font size, weight, line height)

### 3. **Common Issues & Solutions**

#### Issue: Logo/Image Not Showing
- **Solution**: Check if asset was downloaded correctly
- Use remote URI temporarily: `source={{ uri: "https://..." }}`
- Download to local assets for production

#### Issue: Elements Not Centered
- **Solution**: Use `items-center` and `justify-center` in flex containers
- Remove fixed `left-[95px]` positioning
- Use `left-0 right-0` with `items-center` for horizontal centering

#### Issue: Icons Not Matching
- **Solution**: Download actual icon assets from Figma
- Don't use placeholder icons (colored circles, etc.)
- Use exact icon dimensions from Figma specs

### 4. **Figma MCP Commands Reference**

```typescript
// Get design context (code + assets)
mcp_Figma_get_design_context(fileKey, nodeId)

// Get screenshot for visual reference
mcp_Figma_get_screenshot(fileKey, nodeId)

// Get metadata (structure overview)
mcp_Figma_get_metadata(fileKey, nodeId)
```

### 5. **Example: Implementing a Screen**

1. **Get Figma Design**:
   ```
   URL: https://www.figma.com/design/cCTSpr9YiDEeaDdPoX84T3/Platnm-UI?node-id=2184-8100
   File Key: cCTSpr9YiDEeaDdPoX84T3
   Node ID: 2184:8100
   ```

2. **Extract Key Information**:
   - Background: `#0e0e0e`
   - Logo position: `top-[129px]`, centered horizontally
   - Button width: `370px`
   - Spacing: `gap-[24px]` between elements

3. **Download Assets**:
   - Logo: `https://www.figma.com/api/mcp/asset/24c1e340-2bd1-4942-a9ff-c9a0aa27eb4e`
   - Icons: Extract from Figma response

4. **Implement**:
   - Use exact measurements
   - Center elements properly
   - Match colors exactly
   - Use downloaded assets

### 6. **Quick Checklist**

Before considering a design "done":
- [ ] All assets downloaded and working
- [ ] Elements centered correctly (not using fixed left positioning)
- [ ] Colors match Figma exactly (#hex codes)
- [ ] Typography matches (size, weight, line height)
- [ ] Spacing matches (gaps, padding, margins)
- [ ] Button sizes match (width, height, border radius)
- [ ] Icons are actual assets, not placeholders

### 7. **Tips**

- Always get a screenshot from Figma for visual reference
- Use `forceCode: true` when getting design context to ensure full code
- Download assets immediately - Figma URLs expire after 7 days
- Test on actual device/emulator to verify appearance
- Use React Native's `Dimensions` API for responsive layouts when needed


