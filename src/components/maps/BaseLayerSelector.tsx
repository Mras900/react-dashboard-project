import { BASE_LAYERS, type BaseLayerKey } from './mapLayers';

type BaseLayerSelectorProps = {
  selectedLayer: BaseLayerKey;
  onChange: (layer: BaseLayerKey) => void;
  className?: string;
};

export function BaseLayerSelector({ selectedLayer, onChange, className = '' }: BaseLayerSelectorProps) {
  return (
    <div className={`pointer-events-auto flex max-w-[calc(100%-2rem)] flex-wrap gap-1 rounded-lg border border-slate-200 bg-white/95 p-1 text-xs font-bold text-slate-700 shadow-sm ${className}`}>
      {(Object.entries(BASE_LAYERS) as Array<[BaseLayerKey, (typeof BASE_LAYERS)[BaseLayerKey]]>).map(([key, layer]) => {
        const active = selectedLayer === key;

        return (
          <button
            aria-pressed={active}
            className={`h-8 rounded-md px-2.5 transition ${
              active ? 'bg-[#0f5fcf] text-white shadow-sm' : 'text-slate-700 hover:bg-blue-50 hover:text-[#0f5fcf]'
            }`}
            key={key}
            onClick={() => onChange(key)}
            type="button"
          >
            {layer.label}
          </button>
        );
      })}
    </div>
  );
}
