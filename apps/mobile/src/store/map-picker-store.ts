import { create } from 'zustand';

export type PickedLocation = {
  latitude: number;
  longitude: number;
  updatedAt: number;
};

type MapPickerState = {
  pickerInitialLocation: PickedLocation | null;
  selectedLocation: PickedLocation | null;
  setPickerInitialLocation: (location: PickedLocation | null) => void;
  setSelectedLocation: (location: PickedLocation | null) => void;
  clear: () => void;
};

export const useMapPickerStore = create<MapPickerState>((set) => ({
  pickerInitialLocation: null,
  selectedLocation: null,
  setPickerInitialLocation: (pickerInitialLocation) => set({ pickerInitialLocation }),
  setSelectedLocation: (selectedLocation) => set({ selectedLocation }),
  clear: () => set({ pickerInitialLocation: null, selectedLocation: null }),
}));
