# LadeEvents API

### Einleitung

Die API stellt einen „read/write“ Zugriff auf eine Datenbank zur Verfügung, wo sog. „Lade Events“ für E-Auto
Ladestationen gespeichert sind, im Folgenden `EVFREAKSDB` genannt.

Diese sind z.B. erfolgreiche Ladeevents oder aber Störungen (siehe technische Dokumentation für Details und Datenstruktur).


### Zweckbestimmung

Nutzung dieser API beschränkt sich auf einer bidirektionalen Synchronisation der bereits aggregierten Daten.
Das heißt konkret, diese API darf nicht von einem Endgerät (Smartphone App oder Web-App) direkt verwendet werden.
Lediglich eine „Server to Server“ Kommunikation ist hier erlaubt, wo man periodisch den Datenbestand untereinander
abgleicht. Um dies effizient zu tun ist technisch ein sog. „Delta Download“ mittels „Change Token“ implementiert, 
wo man in „batches“ neue, geänderte und gelöschte Datensätze abgeglichen werden können.


### Nutzungsszenario

Eine Web-App oder native Smartphone App nutzt ein eigenes Backend (z.B. CloudKit, Firebase, ..) um die Benutzerdaten
entgegen zu nehmen und zu speichern. Über diese API ist es nun möglich, dieses Backend mit der zentralen
Datenbank `EVFREAKSDB` zu synchronisieren.

Der Vorgang kann zeitgesteuert ablaufen, z.B. alle 10 Minuten. Das eigene Backend kann dabei auch entsprechende Aktionen
triggern, z.B. den jew. Benutzer per Push bei Änderungen benachrichtigen.


### Limitierungen

Ziel ist es, eine übermässige Beanspruchung der Ressourcen zu vermeiden.

* im laufenden Betrieb (cron Jobs) darf ein Abgleich mittels sog. „Pull“ Verfahren nicht öfters als einmal alle 10
  Minuten erfolgen. Während eines Abgleich „Batchs“ sollen zuerst geänderte Datensätze abgeholt werden (Delta Download)
  und (eigene) neue Datensätze übertragen werden.
* manuelle Requests sind jedoch von der o.g. Limitierung ausgeschlossen, z.B. während der Entwicklung können diese bei
  Bedarf initiiert werden.


## Nutzungsbedingungen

* Die API befindet sich aktuell in einer Beta-Testphase. Änderungen an der API, insbesondere technischer Natur können auch
  kurzfristig erfolgen ohne einer vorherigen Ankündigung.
* Die API wird zur Verfügung gestellt „as is“, eine Haftung für Schäden aller Art, die durch die Nutzung entstehen
  ist ausgeschlossen
* Die Zugangsdaten (access token) sind vertraulich zu behandeln und nicht an Dritte weiter geben
* Der Access Token darf nur für eine sog. „Server to Server“ Kommunikation verwendet werden. Der Token darf insbesondere
  nicht in einem Binary, die man an User ausliefert (z.B. App Binary) enthalten sein, auch nicht für Test-Zwecke.
  Auch darf der Token nicht für Web-Apps genutzt werden.
* Die laufende Synchronisation muss im Delta-Download Verfahren ablaufen, um eine unnötige Last auf die API zu vermeiden.
* Der Zugang kann jederzeit und ohne Ankündigung gesperrt werden, insbesondere wenn eine übermässige Nutzung der API
  vorliegt. Siehe auch „Limitierungen“ weiter oben.


### Datenschutz

Alle Daten, die hier ausgetauscht werden, sind **für die öffentliche Nutzung** bestimmt. Diese können also:

* in nativen Apps und Web-Apps angezeigt werden
* durch Google indiziert werden
* an Provider aggregiert weiter gegeben werden
* ohne Ankündigung gelöscht werden (z.B. "Garbage Collection" alter Daten)
* jederzeit modifiziert werden (z.B. wenn neue Features dazu kommen und neue Felder andere default values haben etc.).

Dies ist nun dem User, der diese Daten erfasst, vorab zu kommunizieren (evtl. direkt während der Eingabe oder über die 
Nutzungsbedingungen der Applikation indirekt).

#### Privatsphäre

Insbesondere ist technisch dafür zu sorgen, dass keine privaten Daten, wovon auszugehen ist, dass der Benutzer nicht damit
einverstanden ist (z.B. eigene E-Mail Adresse) oder weiteres in diese Daten automatisch landen.


## Referenzen

1. [Technische Spezifikation der API (Englisch)](API.md)
