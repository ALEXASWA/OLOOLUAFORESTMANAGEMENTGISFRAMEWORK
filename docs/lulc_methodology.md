# LULC and forest-analysis methodology

FM-GDSS stores analytical methodology in each forest's `ForestProfile`. Oloolua is the first completed implementation and uses the supplied Google Earth Engine Sustainable Forest Ecosystem Analysis as its baseline.

## Oloolua baseline

- Epochs: 1990, 2000, 2010, 2020, 2025.
- Historical LULC: Landsat historical composites at 30 m.
- Current LULC: Sentinel-2 SR Harmonized at 10 m.
- Cross-epoch derived analysis: 30 m grid; the 2025 categorical map is mode-aggregated from 10 m before transitions and change products.
- Analysis CRS: EPSG:32737.
- Context region: a configurable 100 m external analytical buffer, distinct from the original forest boundary.
- Classes: 1 Forest, 2 Grassland, 3 Quarry, 4 Built-up.
- Water is excluded unless a future forest's source dataset explicitly defines it.
- Training/validation: polygon-level random split, 70/30, seed 42. This is reference-polygon validation and must not be described as historical field validation.

## Derived indicators

The baseline may produce LULC transitions, forest loss/gain, built-up and quarry expansion, NDVI condition and change, forest density, fragmentation, edge/core structure, remotely detectable anthropogenic pressure, conservation priority, rehabilitation priority, and proposed management zones.

NDVI is a vegetation-condition indicator, not a direct measure of forest health. Anthropogenic pressure is a remotely detectable spatial proxy, not proof of causation. Management zones are proposed analytical decision-support zones and are not legally gazetted boundaries.

## Future forests

A future forest is onboarded by creating a `Forest` and `ForestProfile` record with its own epochs, class schema, source sensors, native/derived scales, CRS, training split and methodology metadata. Analysis services and imports must read those profile fields rather than assuming Oloolua values.
