import { Preset } from "./types";

export const PRESETS: Preset[] = [
  {
    id: "cave-self-supporting",
    name: "Höhlen-Klassiker (Selbstragend)",
    description: "Das klassische Höhlenbeispiel des Users. Die Decke bei y=3 ist über die Seiten pfeilerartig mit dem Boden (y=0) verbunden. CP-SAT erkennt automatisch: 0 zusätzliche Support-Pixel notwendig!",
    coordinates: [
      [0, 0], [1, 0], [2, 0], [3, 0], [4, 0],
      [0, 1],                         [4, 1],
      [0, 2],                         [4, 2],
      [0, 3], [1, 3], [2, 3], [3, 3], [4, 3]
    ]
  },
  {
    id: "floating-pixel",
    name: "Schwebendes Pixel",
    description: "Ein einzelnes Pixel schwebt einsam auf y=3. Da es keinen Kontakt zum Boden oder stabilen Nachbarn hat, muss ein vertikaler Pfeiler (S) bis zum Boden gegossen werden.",
    coordinates: [
      [2, 3]
    ]
  },
  {
    id: "unsupported-roof",
    name: "Schwebende Decke (Säulenbrücke)",
    description: "Ein Dach bei y=3, getragen von zwei weit entfernten Stützen. Doch die linke Stütze schwebt in der Luft! Es muss supportet werden, bis die Kraft an den Boden übertragen wird.",
    coordinates: [
      [0, 3], [1, 3], [2, 3], [3, 3], [4, 3],
      [0, 2],                         [4, 2],
      [0, 1],                         [4, 1],
                                      [4, 0] // Linke Säule berührt den Boden NICHT bei (0,0)!
    ]
  },
  {
    id: "overhang-t",
    name: "T-Form Überhang",
    description: "Eine T-Struktur. Der zentrale Stamm steht stabil auf y = 0..2, aber die linken und rechten Arme ragen v-förmig heraus. Die Endstücke benötigen oft punktuellen Support.",
    coordinates: [
      [2, 0],
      [2, 1],
      [2, 2],
      [0, 3], [1, 3], [2, 3], [3, 3], [4, 3]
    ]
  },
  {
    id: "c-shape",
    name: "C-Bracket",
    description: "Ein nach rechts offenes 'C'. Das obere Ende hängt frei in der Luft, ist aber elastisch nach links mit dem Mast verbunden. CP-SAT berechnet das ohne Support!",
    coordinates: [
      [0, 0], [1, 0], [2, 0],
      [0, 1],
      [0, 2],
      [0, 3], [1, 3], [2, 3]
    ]
  },
  {
    id: "adversarial-omega",
    name: "Adversarial Spiral (Omega)",
    description: "Ein extrem komplexes Muster. Viele Heuristiken (z.B. greedy abwärts) fallen hier auf die Nase, weil sie zyklische Abhängigkeiten bilden oder unnötigen Support spucken. Das CP-SAT-Modell findet die mathematische globale Minimallösung.",
    coordinates: [
      [0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0],
      [0, 1],                                 [5, 1],
      [0, 2],         [2, 2], [3, 2], [4, 2], [5, 2],
      [0, 3],         [2, 3],                 [5, 3],
      [0, 4], [1, 4], [2, 4],                 [5, 4],
                                              [5, 5]
    ]
  },
  {
    id: "double-overhang",
    name: "Doppel-Balkon",
    description: "Zwei Balkone stehen übereinander. Es ist oft optimal, nur den oberen abzustützen (von unten) oder beide schlau miteinander zu verketten, um Material zu sparen.",
    coordinates: [
      [1, 0], [2, 0],
      [1, 1],
      [1, 2], [2, 2], [3, 2],
      [1, 3],
      [1, 4], [2, 4], [3, 4], [4, 4]
    ]
  }
];
