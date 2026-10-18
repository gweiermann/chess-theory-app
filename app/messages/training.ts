import type { Message } from '../modules/training'
export const trainingMessages: Record<Message, string> = {
  ready: 'Wähle eine Figur und anschließend ihr Zielfeld.',
  correct: 'Gut erkannt. Jetzt antwortet dein Gegner.',
  retry:
    'Diese Fortsetzung gehört nicht zu dieser Übung. Du hast einen zweiten Versuch; der Zug kann trotzdem spielbar sein.',
  solution:
    'Der blaue Pfeil zeigt eine Fortsetzung. Spiele den Zug selbst, dann geht es weiter.',
  outside: 'Diese Fortsetzung liegt außerhalb des gewählten Repertoires.',
  illegal:
    'Dieser Zug ist in der Stellung nicht legal. Versuche einen anderen Zug.',
  new: 'Neue Variante: Hier lernst du etwas Neues. Hilfe zählt nicht als vergessener Zug.',
  'premove-cancelled': 'Vorzug nicht möglich.',
  premove:
    'Dein Vorzug ist vorgemerkt. Nach der Gegnerantwort prüfen wir, ob er möglich ist.',
  recall:
    'Die Zugfolge ist aufgebaut. Jetzt spielst du sie aus dem Gedächtnis.',
  repeat:
    'Noch einmal festigen. Nur Wiederholungen ohne Fehler und Hilfe zählen als gemeistert.',
  complete:
    'Runde abgeschlossen. Deine Antworten sind im Lernverlauf vermerkt.',
  'stale-session':
    'Die gespeicherte Runde passt nicht mehr zur Bibliothek. Wir beginnen mit einer frischen Stellung.',
}
