# Tools voor Teksten aanpassen: instructies voor de AI

Je helpt iemand die deze tool naar eigen smaak wil maken. Ga ervan uit dat die persoon geen programmeur is. Dit bestand vertelt wat je vrij mag veranderen en wat heel moet blijven.

## Hoe je werkt

- Werk in een kopie van de map. Het origineel blijft onaangeroerd.
- Maak één wijziging per keer, zo klein als kan.
- Leg in gewone taal uit wat je hebt veranderd en hoe de gebruiker dat zelf controleert.
- Zeg eerlijk wat je werkelijk hebt getest en wat niet.
- Publiceer, verstuur of upload niets. Vraag de gebruiker niet om echte documenten; gebruik de fictieve voorbeelden in `examples/`.
- De gebruiker moet na een wijziging opnieuw bouwen. Help daar stap voor stap bij: Node.js 22.12 of nieuwer, dan `npm ci`, `npm run build:web` en `npm run serve`.

## Waar alles staat

| Wat | Waar |
|---|---|
| Kleuren, letters, groottes, afstanden | `src/tokens.css` (begin hier voor het uiterlijk) |
| Indeling en vormgeving van onderdelen | `src/style.css` |
| Het scherm, de knoppen en wat er bij een klik gebeurt | `src/main.js` |
| Documenten omzetten, samenvoegen, vergelijken, metadata | `src/core.js` |
| Herkenning van persoonsgegevens | `src/models.js` |
| De fictieve voorbeelddocumenten | `src/examples.js` en `examples/` |
| Naam in het tabblad | `index.html` |
| Iconen | `assets/`; `scripts/prepare-assets.mjs` neemt ze mee bij het bouwen |
| De ontwerpafspraken van de maker | `design.md` (ter informatie; geen voorschrift voor een eigen versie) |

Houd in `src/main.js` elke `import` op één regel. De tests rekenen daarop.

## Vrij te veranderen

Kleuren, letters, indeling, naam, icoon, alle teksten, de taal, de markering bij afschermen, extra invoerformaten en nieuwe tools. Dit is een vertrekpunt: de vormgeving van de maker is geen voorschrift.

## Wat heel moet blijven

1. **Documenten blijven op het apparaat.** Geen upload van documentinhoud, geen logboek van inhoud, geen tracking. Voeg geen dienst toe waar tekst naartoe gaat, tenzij de gebruiker er uitdrukkelijk om vraagt en begrijpt wat dat betekent.
2. **Originelen worden nooit overschreven.** De tool maakt kopieën.
3. **Geen stil verlies.** Een mislukte bron stopt het samenvoegen; er komt geen onvolledig eindbestand. Wat bij omzetten verloren gaat, wordt gemeld.
4. **Geen belofte van volledige anonimisering.** De markering is zichtbaar vervangen tekst, geen certificaat. Houd de waarschuwing in beeld dat de gebruiker zelf controleert.
5. **Eerlijk over internet.** De herkenning van persoonsgegevens haalt de eerste keer modelbestanden op. Verberg dat niet.
6. **Licenties van anderen.** De Desert Ant Labs-onderdelen hebben eigen voorwaarden en vallen niet onder MIT. Laat `LICENSE`, `THIRD_PARTY_NOTICES.md` en `THIRD_PARTY_LICENSES/` staan en verwijder de vermelding van Desert Ant Labs niet.

## Controleren na elke wijziging

1. `npm test` moet slagen.
2. Bouw en start de kopie, klik **Probeer een voorbeeld** en maak een Markdown-bestand.
3. Download het resultaat en open het in een teksteditor.
4. Probeer de tool die je hebt aangepast met een fictief document.

Verander je bewust wat de tool uitvoert, pas dan ook de bijbehorende test in `tests/` aan en zeg dat erbij.

## Een eigen versie delen

Voor eigen gebruik hoeft de gebruiker niets te hernoemen. Wil hij zijn versie verspreiden, dan gelden de afspraken in `MERKVOORWAARDEN.md`: eigen naam en eigen icoon, en geen FMT of fastmovingtargets.nl meer in beeld. "Gebaseerd op Tools voor Teksten" vermelden mag. De voorwaarden van Desert Ant Labs blijven ook voor een eigen versie gelden.
