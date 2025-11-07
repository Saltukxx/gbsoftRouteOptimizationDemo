# Vehicle Icons

This directory contains sprite atlases for vehicle visualization in the demo.

## Required Icons

The application expects a `vehicle-atlas.png` file containing:
- Truck icons for vehicles
- Depot icons for distribution centers  
- Delivery point icons

## Creating Icon Atlas

You can create the atlas manually or use the following placeholder structure:

```
vehicle-atlas.png (384x128 pixels)
├── truck    (0,   0, 128, 128) - Vehicle icon
├── depot    (128, 0, 128, 128) - Depot icon  
└── delivery (256, 0, 128, 128) - Delivery point icon
```

For the demo, simple colored circles or basic truck/building icons work well.

## Fallback

If icons are not provided, the application will use Deck.gl's default markers with different colors.