const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "ambiance": "Nuit",
  "toucher": "Remuer",
  "grain": 1
}/*EDITMODE-END*/;

const AMB = {
  Nuit:  { cacao: '#171512', brun: '#24201A', glow: '#B85C38' },
  Braise:{ cacao: '#1C120D', brun: '#2C1B13', glow: '#E07A3F' },
  'Forêt': { cacao: '#0F1611', brun: '#18231B', glow: '#4F8A5E' }
};
const TOUCH = { Effleurer: .4, Remuer: 1, Creuser: 2.4 };

function MDGTweaks() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  React.useEffect(() => {
    const a = AMB[t.ambiance] || AMB.Nuit, r = document.documentElement.style;
    r.setProperty('--color-cacao', a.cacao); r.setProperty('--color-brun', a.brun); r.setProperty('--v3-glow', a.glow);
    window.MDGTW = { grain: t.grain, touch: TOUCH[t.toucher] ?? 1 };
  }, [t.ambiance, t.toucher, t.grain]);
  return (
    <TweaksPanel>
      <TweakSection label="Atmosphère" />
      <TweakRadio label="Lumière de la scène" value={t.ambiance} options={Object.keys(AMB)} onChange={v => setTweak('ambiance', v)} />
      <TweakSection label="Matière" />
      <TweakRadio label="La main dans les grains" value={t.toucher} options={Object.keys(TOUCH)} onChange={v => setTweak('toucher', v)} />
      <TweakSlider label="Grosseur des grains" value={t.grain} min={0.6} max={1.8} step={0.05} unit="×" onChange={v => setTweak('grain', v)} />
    </TweaksPanel>
  );
}
ReactDOM.createRoot(document.getElementById('tweaks-root')).render(<MDGTweaks />);
