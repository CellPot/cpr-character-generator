# Генератор персонажа для Cyberpunk RED

Мастер создания персонажа для Cyberpunk RED. Одна HTML-страница, без регистрации, работает
без интернета. Русский и английский. [English version](README.md)

**[▶ Открыть онлайн](https://cellpot.github.io/cpr-character-generator/)** или скачать
`generator.html` и открыть в браузере.

- Все три метода создания из корбука, с бросками или вручную.
- Производные числа, каталог снаряжения с ценами, страница книги у каждого правила.
- Печать / PDF, заметка в Markdown, сохранение в `.json`. Персонаж остаётся в вашем браузере.

Не замена книгам: механика и краткий пересказ своими словами.

## Сборка

`python build.py` пересобирает `generator.html` (Python 3, только стандартная библиотека).
`data/` экспортируется из закрытого проекта и здесь руками не правится.

Issues приветствуются, pull request'ы не принимаются.

## Благодарности

Русские термины в основном взяты из фанатских переводов книг Cyberpunk RED. Спасибо
[rustablerpg.ru](https://rustablerpg.ru) и [vk.com/cyberpunk_red_rus](https://vk.com/cyberpunk_red_rus),
группе VK «Cyberpunk RED на русском языке», @kr45n1y ([t.me/redcyberpunk](https://t.me/redcyberpunk))
и LieSnPeace ([t.me/cyberpunk_red_rus](https://t.me/cyberpunk_red_rus)).

## Правовое

Неофициальный материал по
[Homebrew Content Policy](https://rtalsoriangames.com/homebrew-content-policy/)
R. Talsorian Games; RTG его не одобряла и не поддерживает. Cyberpunk — зарегистрированный
товарный знак CD PROJEKT S.A.; Cyberpunk RED и его правила принадлежат R. Talsorian Games.
Текст книг не копируется: на странице случайные таблицы, названия и числа, которые политика
разрешает, и описания, написанные заново.

Код: [MIT](LICENSE) (игровые материалы не включены). Шрифт Play: SIL OFL 1.1,
[`LICENSES/Play-OFL.txt`](LICENSES/Play-OFL.txt).
