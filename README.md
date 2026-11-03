# Tools voor Teksten

**Jouw informatie. In bruikbare bestanden. Onder jouw controle.**

Zet documenten om naar Markdown, controleer persoonsgegevens en metadata, voeg documenten samen en vergelijk versies. De documentinhoud wordt op je eigen apparaat verwerkt.

Ik maakte dit met AI omdat ik het zelf nodig had. Ik ben geen programmeur en geen designer. Door mijn tools te delen wil ik laten zien wat er nu mogelijk is en je inspireren om zelf aan de slag te gaan. Gebruik dit als vertrekpunt: bouw erop voort en maak het naar je eigen maat. Ik bedacht wat de tool moest kunnen; AI schreef de code. Nu mag jij ermee verder, met of zonder AI als bouwmaatje.

## Meteen gebruiken

- **Online:** [open Tools voor Teksten](https://tools-voor-teksten-fmt.erwinblom.chatgpt.site/). Geen account nodig.
- **Mac met Apple Silicon:** [download versie 1.0.0](https://github.com/erwinblom/tools-voor-teksten/releases/download/v1.0.0/Tools-voor-Teksten-1.0.0-mac-arm64.zip). Geen Node- of Python-installatie nodig.
- **Alle bestanden en versies:** [GitHub Releases](https://github.com/erwinblom/tools-voor-teksten/releases/tag/v1.0.0).

Bugs melden is welkom. Nog liever zien we dat je zelf gaat bouwen en aanpassen. Deel gerust wat je maakt; dat is geen verplichting. Er is geen belofte van onbeperkte ondersteuning.

## Download starten op Mac

Deze eerste download is voor **Apple Silicon (M1 of nieuwer), macOS 13.5 of nieuwer**, met een actuele Chrome, Edge of Safari. Het is dezelfde browserapp als online, met een meegeleverde lokale startserver. Het is geen genotariseerde native Mac-app. Intel, Windows en Linux krijgen in deze uitgave geen kant-en-klare download; de broncode is wel beschikbaar.

1. Download de ZIP en pak hem helemaal uit, bijvoorbeeld in je map Programma’s of Documenten. Laat de uitgepakte bestanden bij elkaar.
2. Dubbelklik op **Start.command**. Een Terminal-venster opent en je standaardbrowser toont de tool op een lokaal adres (`127.0.0.1`).
3. Laat het Terminal-venster open zolang je de tool gebruikt. Stop met **Ctrl+C** in dat venster. Daarna kun je het venster sluiten.
4. Als macOS het startbestand blokkeert, controleer eerst de herkomst en de SHA-256 in de release. De download is niet genotariseerd; volg alleen de normale macOS-route voor software die je vertrouwt. Er worden geen beveiligingsinstellingen automatisch gewijzigd. Gebruik bij twijfel de online versie.

De meegeleverde Node-runtime start alleen deze lokale bestandsserver. Er luistert niets op je netwerkadres; er wordt geen documentmap als server beschikbaar gemaakt.

## Je eerste resultaat

1. Klik **Probeer een voorbeeld** of **Kies map of bestand**.
2. Selecteer de bestanden links en kies **Naar Markdown**.
3. Klik **Maak Markdown**, bekijk het resultaat en download het `.md`-bestand.
4. Open dat bestand in een teksteditor naar keuze. Het blijft buiten deze tool bruikbaar. Voor meerdere resultaten kun je één ZIP downloaden; de relatieve mappenstructuur blijft daarin behouden.

Je originelen worden niet overschreven. Je browser bepaalt de downloadmap. De bestandenlijst en niet-gedownloade resultaten verdwijnen bij herladen of sluiten: download je resultaat vóór je afsluit. Het sluiten van het browservenster stopt de lokale server niet; gebruik daarvoor Ctrl+C in Terminal.

## De vijf tools

| Tool | Resultaat |
| --- | --- |
| Naar Markdown | Markdown uit TXT, HTML, DOCX, MD of een PDF met tekstlaag. |
| Persoonsgegevens afschermen | Controleer modelvondsten, voeg zelf selecties toe en maak een Markdown-kopie met `[xxx]`. |
| Metadata controleren | Bekijk documenteigenschappen en verwijder gekozen YAML-velden uit een Markdown-kopie. Het oorspronkelijke Word/PDF-bestand wordt niet opgeschoond. |
| Documenten samenvoegen | Kies volgorde, titel en bestandsnaam. Maak één Markdown-bestand met bronvermelding per onderdeel. |
| Versies vergelijken | Bekijk toegevoegde en verwijderde tekst tussen twee documenten. |

De voorbeelden zijn volwaardige fictieve documenten. Namen, contactgegevens, organisaties en bedragen zijn verzonnen.

## Privacy, AI en offline gebruik

**Zonder internet:** in de uitgepakte Mac-download werken Naar Markdown, metadata bekijken, samenvoegen, vergelijken en handmatig afschermen met lokale bestanden. Er zijn geen API-sleutels nodig. De online versie moet uiteraard eerst bereikbaar zijn om te laden.

**AI-herkenning:** Redact draait op je apparaat, maar de eerste keer worden officiële model/runtimebestanden opgehaald bij Hugging Face, unpkg en jsDelivr. De ongewijzigde SDK gebruikt ook een verplicht licentiesignaal. De download is dus **niet volledig offline** wanneer je deze AI-functie gebruikt. Volgens de Desert Ant Labs-licentie bevat die licentietelling geen invoer, uitvoer of documentinhoud.

De app verstuurt je documentinhoud niet naar een AI-server. De lokale server houdt geen inhoudslog bij. De modellen kunnen gegevens missen: controleer altijd de hele tekst, de bestandsnaam en de uiteindelijke kopie vóór delen. `[xxx]` is een zichtbare vervangmarkering, geen certificaat van anonimisering.

On-device AI by [Desert Ant Labs](https://desertant.com). De standaard publieke en downloadbare uitgaven gebruiken dezelfde lokale AI-route. Wie zelf de modellen wil hosten, kan `npm run prepare-models` en de lokale build gebruiken; de DAL-voorwaarden en licentietelling blijven gelden.

## Grenzen van deze versie

- Maximaal 200 geselecteerde bestanden; 50 MB per bestand; 500 pagina’s per PDF.
- De samenvoegfunctie begrenst de gezamenlijke tekst tot 10 miljoen tekens. Een mislukte bron stopt de hele samenvoeging; er komt geen stil onvolledig eindbestand.
- Geen OCR voor scans en geen audio-transcriptie. Een PDF zonder uitleesbare tekst wordt duidelijk geweigerd.
- Tabellen en complexe leesvolgorde moeten worden gecontroleerd. Afbeeldingen worden tekstbeschrijvingen; afbeeldingen/bijlagen worden niet als losse bestanden geëxporteerd. Sommige Word-tabellen blijven als HTML-tabel binnen Markdown behouden.
- Geen volledige opschoning van verborgen tekstlagen, bijlagen of oorspronkelijke PDF/DOCX-containers.
- Geen account, cloudopslag, autosave of synchronisatie van je documenten.
- Geen overheids-, privacy- of toegankelijkheidscertificering.

## Zelf hosten of ontwikkelen

De bron is een Vite-browserapp zonder documentbackend. Node 22.12 of nieuwer en npm zijn nodig voor bouwen; onze meegeleverde Mac-runtime is afzonderlijk gepind.

```sh
npm ci
npm test
npm run build:web
npm run serve
```

Open het getoonde adres. De gehoste webversie gebruikt dezelfde `dist/`-bestanden. Voor ontwikkeling: `npm run dev`. Voor een build met lokaal gehoste modelbestanden: eerst `npm run prepare-models`, daarna `npm run build`. Houd rekening met het downloadvolume, de DAL-voorwaarden en de vereiste runtimefuncties van actuele browsers.

De icoonbronnen staan in `assets/`. `scripts/prepare-assets.mjs` neemt ze automatisch mee in beide builds. Verander de themakleuren centraal in `src/tokens.css`; pas de functies aan in `src/main.js` en `src/core.js`. `design.md` beschrijft de ontwerpafspraken.

## Verder bouwen met ChatGPT of Claude

1. Download de **broncode** van GitHub en maak een aparte projectkopie. Een gewone chat wijzigt je lokale bestanden niet vanzelf.
2. Open die kopie in een AI-codeomgeving, of geef een gewone chat het complete bronpakket en deze handleiding. Deel geen privébestanden of sleutels.
3. Begin met één concrete wens, bijvoorbeeld: ‘Maak het rode accent blauw, maar behoud alle functies en de plaatsing van de knoppen.’
4. Laat de gewijzigde bestanden teruggeven, bouw of start je kopie en voer opnieuw een echte taak uit.

Startprompt:

> Dit is het volledige bronpakket van een tool die ik naar mijn eigen smaak wil aanpassen. Ik ben geen programmeur. Lees eerst de bestanden en de handleiding. Mijn eerste wens is: [één concrete wijziging, met wat gelijk moet blijven]. Maak de kleinste passende wijziging. Werk in een aparte projectkopie als je lokale bestanden kunt bewerken; lever anders het complete gewijzigde project als download en noem welke bestanden veranderden. Help me stap voor stap bouwen of starten op mijn eigen computer. Behoud bestaande functies, licenties en mijn gegevens. Publiceer of verstuur niets. Vertel wat je daadwerkelijk hebt getest en wat ik zelf moet controleren.

Als een chatdownload niet werkt, vraag: ‘Geef exact welke tekst ik zoek en vervang, met bestandsnaam en aantal wijzigingen.’ Geef een foutmelding volledig terug, zonder geheime gegevens. Meld bugs via [GitHub Issues](https://github.com/erwinblom/tools-voor-teksten/issues); vermeld je besturingssysteem, browser en stappen met fictieve bestanden.

## Licenties, merken en credits

De eigen appcode en technische documentatie zijn beschikbaar onder [MIT](LICENSE), copyright 2026 Erwin Blom. Dat geldt niet automatisch voor de gebruikte externe onderdelen of FMT-merken. Je hoeft wijzigingen niet terug te sturen.

De Desert Ant Labs-SDK en -modellen zijn **source-available**, met hun eigen voorwaarden; ze worden niet door onze MIT-licentie open source. Bekijk [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) en `THIRD_PARTY_LICENSES/`. De meegeleverde Node-runtime heeft zijn eigen licentie en notices. Merkgebruik staat in [MERKVOORWAARDEN.md](MERKVOORWAARDEN.md). FMT staat op het gereedschap; je eigen uitvoer krijgt geen verplicht FMT-logo.

De openbare repository begint met een schone geschiedenis. Persoonlijke projectgegevens, Sites-configuratie, privé-opdrachtenregister, caches en eerdere interne Git-geschiedenis zijn geen onderdeel van deze uitgave.
