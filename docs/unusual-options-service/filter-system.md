# Unusual Options Scanner - Filter System

## Overview

The filter system is a modular, scalable architecture that allows users to
refine and narrow down unusual options signals based on various criteria.
The system is designed with extensibility in mind, making it easy to add
new filters without modifying core logic.

## Architecture

### Component Structure

```
filters/
├── index.ts                  # Central export point
├── FilterPanel.tsx           # Orchestrating container component
├── DateRangeFilter.tsx       # Date-based filtering
├── GradeFilter.tsx           # Signal grade filtering
├── OptionTypeFilter.tsx      # Call/Put filtering
├── PremiumFlowFilter.tsx     # Premium flow range filtering
└── DetectionFlagsFilter.tsx  # Pattern detection filtering
```

### Design Principles

1. **Modularity**: Each filter is a self-contained, reusable component
2. **Scalability**: New filters can be added without touching existing code
3. **Composability**: Filters can be combined and orchestrated easily
4. **Type Safety**: Full TypeScript support with proper interfaces
5. **State Management**: Clean, predictable state flow

## Available Filters

### 1. Date Range Filter (`DateRangeFilter.tsx`)

Filters signals by their detection timestamp.

**Features:**

- Single date selection
- Quick presets (Today, Yesterday, Last 3 days, Last 7 days)
- Clear button for easy reset

**Usage:**

```tsx
<DateRangeFilter
  value={filters.detection_date}
  onChange={(date) => updateFilter('detection_date', date)}
  label="Detection Date"
/>
```

**API Integration:**

- Maps to `detection_date` in `UnusualOptionsFilters`
- Backend queries signals within the selected date range
- Uses `detection_timestamp` field for comparison

### 2. Grade Filter (`GradeFilter.tsx`)

Filters signals by their quality grade (S, A, B, C, D, F).

**Features:**

- Multi-select badge interface
- Color-coded grades for quick identification
- "Clear selection" button

**Usage:**

```tsx
<GradeFilter
  value={filters.grade}
  onChange={(grades) => updateFilter('grade', grades)}
  label="Signal Grade"
/>
```

**API Integration:**

- Maps to `grade` in `UnusualOptionsFilters`
- Backend uses SQL `IN` operator for multi-select
- Filters on `grade` column

### 3. Option Type Filter (`OptionTypeFilter.tsx`)

Filters signals by option type (Calls or Puts).

**Features:**

- Toggle between Calls and Puts
- Color-coded (green for calls, red for puts)
- "Show all" button

**Usage:**

```tsx
<OptionTypeFilter
  value={filters.option_type}
  onChange={(types) => updateFilter('option_type', types)}
  label="Option Type"
/>
```

**API Integration:**

- Maps to `option_type` in `UnusualOptionsFilters`
- Backend uses SQL `IN` operator
- Filters on `option_type` column

### 4. Premium Flow Filter (`PremiumFlowFilter.tsx`)

Filters signals by premium flow range (min/max).

**Features:**

- Min/max range inputs
- Quick presets (≥$100K, ≥$500K, ≥$1M, ≥$5M)
- Clear button for both values

**Usage:**

```tsx
<PremiumFlowFilter
  minValue={filters.min_premium_flow}
  maxValue={filters.max_premium_flow}
  onMinChange={(val) => updateFilter('min_premium_flow', val)}
  onMaxChange={(val) => updateFilter('max_premium_flow', val)}
  label="Premium Flow Range"
/>
```

**API Integration:**

- Maps to `min_premium_flow` and `max_premium_flow`
- Backend uses `gte` and `lte` operators
- Filters on `premium_flow` column

### 5. Detection Flags Filter (`DetectionFlagsFilter.tsx`)

Filters signals by detection pattern flags.

**Features:**

- Toggle filters for:
  - Volume Anomaly
  - OI Spike
  - Sweep
  - Block Trade
- Active count indicator
- "Clear all" button

**Usage:**

```tsx
<DetectionFlagsFilter
  hasVolumeAnomaly={filters.has_volume_anomaly}
  hasOiSpike={filters.has_oi_spike}
  hasSweep={filters.has_sweep}
  hasBlockTrade={filters.has_block_trade}
  onVolumeAnomalyChange={(val) => updateFilter('has_volume_anomaly', val)}
  onOiSpikeChange={(val) => updateFilter('has_oi_spike', val)}
  onSweepChange={(val) => updateFilter('has_sweep', val)}
  onBlockTradeChange={(val) => updateFilter('has_block_trade', val)}
  label="Detection Patterns"
/>
```

**API Integration:**

- Maps to boolean flags in `UnusualOptionsFilters`
- Backend uses equality checks
- Filters on respective boolean columns

## Filter Panel (`FilterPanel.tsx`)

The orchestrating component that brings all filters together.

**Features:**

- Slide-out panel design (right-side drawer)
- Active filter count badge
- Clear all functionality
- Apply and close actions
- Scrollable filter list

**Usage:**

```tsx
<FilterPanel
  isOpen={filterPanelOpen}
  onClose={() => setFilterPanelOpen(false)}
  filters={filters}
  onFiltersChange={setFilters}
  onApply={() => loadData(true)}
/>
```

**Props:**

- `isOpen`: Controls panel visibility
- `onClose`: Callback when panel is closed
- `filters`: Current filter state
- `onFiltersChange`: Callback to update filters
- `onApply`: Callback to apply filters and fetch data

## Adding New Filters

### Step 1: Create Filter Component

Create a new file in `components/unusual-options/filters/`:

```tsx
// NewFilter.tsx
'use client';

import { Label } from '@/components/ui/label';

interface NewFilterProps {
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  label?: string;
}

export function NewFilter({
  value,
  onChange,
  label = 'New Filter',
}: NewFilterProps) {
  return (
    <div className="space-y-2">
      <Label className="text-xs font-medium text-foreground">{label}</Label>

      {/* Your filter UI here */}
    </div>
  );
}
```

### Step 2: Export from index.ts

Add to `filters/index.ts`:

```tsx
export { NewFilter } from './NewFilter';
```

### Step 3: Add to FilterPanel

Import and use in `FilterPanel.tsx`:

```tsx
import { NewFilter } from "./NewFilter";

// In the render:
<Separator className="opacity-50" />
<NewFilter
  value={filters.new_field}
  onChange={(val) => updateFilter('new_field', val)}
/>
```

### Step 4: Update Type Definition

Add to `UnusualOptionsFilters` in
`lib/types/unusual-options.ts`:

```tsx
export interface UnusualOptionsFilters {
  // ... existing filters
  new_field?: string;
}
```

### Step 5: Update API Integration

Add to `lib/api/unusual-options.ts`:

```tsx
if (filters.new_field) {
  query = query.eq('new_field', filters.new_field);
}
```

## State Management

### Filter State Flow

1. **User Interaction**: User clicks/types in a filter component
2. **Local State Update**: Component updates its local state
3. **Callback Execution**: Component calls `onChange` with new value
4. **Global State Update**: Parent updates `filters` state object
5. **Apply Filters**: User clicks "Apply" button
6. **Data Fetch**: `loadData()` is called with updated filters
7. **API Request**: Filters are sent to backend via API
8. **UI Update**: New filtered data is displayed

### Filter Persistence

Currently, filters are stored in component state and reset on page
reload. To add persistence:

1. **localStorage**: Store filters in browser
2. **URL Query Params**: Encode filters in URL
3. **User Preferences**: Save to database

Example with localStorage:

```tsx
// Save filters
useEffect(() => {
  localStorage.setItem('unusual-options-filters', JSON.stringify(filters));
}, [filters]);

// Load filters
useEffect(() => {
  const saved = localStorage.getItem('unusual-options-filters');
  if (saved) {
    setFilters(JSON.parse(saved));
  }
}, []);
```

## Performance Considerations

### Debouncing

For text inputs (like ticker search), consider debouncing:

```tsx
const debouncedSearch = useMemo(
  () =>
    debounce((term: string) => {
      setSearchTerm(term);
      loadData(true);
    }, 300),
  []
);
```

### Memoization

Filter components use React's built-in optimizations. For expensive
calculations, use `useMemo`:

```tsx
const activeFilterCount = useMemo(() => {
  return Object.keys(filters).filter(
    (k) => filters[k as keyof UnusualOptionsFilters] !== undefined
  ).length;
}, [filters]);
```

## Testing

### Unit Tests

Test individual filter components:

```tsx
import { render, fireEvent } from '@testing-library/react';
import { DateRangeFilter } from './DateRangeFilter';

test('DateRangeFilter calls onChange with selected date', () => {
  const onChange = jest.fn();
  const { getByRole } = render(
    <DateRangeFilter value={undefined} onChange={onChange} />
  );

  const input = getByRole('textbox');
  fireEvent.change(input, { target: { value: '2024-01-15' } });

  expect(onChange).toHaveBeenCalledWith('2024-01-15');
});
```

### Integration Tests

Test FilterPanel with multiple filters:

```tsx
test('FilterPanel applies multiple filters correctly', () => {
  const onApply = jest.fn();
  const { getByText } = render(
    <FilterPanel
      isOpen={true}
      onClose={() => {}}
      filters={{}}
      onFiltersChange={() => {}}
      onApply={onApply}
    />
  );

  // Select filters
  fireEvent.click(getByText('Grade S'));
  fireEvent.click(getByText('Calls'));

  // Apply
  fireEvent.click(getByText('Apply Filters'));

  expect(onApply).toHaveBeenCalled();
});
```

## Accessibility

All filter components follow accessibility best practices:

- Semantic HTML with proper labels
- Keyboard navigation support
- ARIA attributes where needed
- Focus management
- Screen reader compatibility

Example:

```tsx
<Label htmlFor="date-filter" className="text-xs font-medium">
  Detection Date
</Label>
<Input
  id="date-filter"
  type="date"
  aria-label="Select detection date"
  value={inputDate}
  onChange={handleDateChange}
/>
```

## Future Enhancements

### Planned Filters

1. **Sentiment Filter**: Filter by BULLISH/BEARISH/NEUTRAL
2. **Risk Level Filter**: Filter by LOW/MEDIUM/HIGH/EXTREME
3. **Moneyness Filter**: Filter by ITM/ATM/OTM
4. **Days to Expiry Range**: Min/max days to expiration
5. **Volume Ratio Filter**: Filter by volume ratio threshold
6. **Strike Range Filter**: Filter by strike price range

### Advanced Features

1. **Filter Presets**: Save and load filter combinations
2. **Filter Groups**: AND/OR logic between filter groups
3. **Advanced Date Ranges**: Custom ranges, relative dates
4. **Bulk Actions**: Apply actions to filtered results
5. **Export Filtered Data**: Download filtered signals as CSV

## Summary

The filter system provides a clean, scalable architecture for filtering
unusual options signals. Its modular design makes it easy to extend and
maintain, while providing a great user experience with intuitive controls
and real-time feedback.

Key benefits:

- ✅ Modular and reusable components
- ✅ Type-safe with full TypeScript support
- ✅ Easy to extend with new filters
- ✅ Clean state management
- ✅ Responsive and accessible UI
- ✅ Production-ready with proper error handling
