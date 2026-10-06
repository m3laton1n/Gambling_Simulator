import Phaser from 'phaser';

// Игровые константы (вынесены, чтобы баланс легко править)
const START_MONEY = 1000; // стартовые деньги игрока
const DEBT = 10000; // долг — цель игры, при его покрытии победа
const WIN_CHANCE = 0.5; // шанс выигрыша одной ставки
const BETS = [10, 100, 1000] as const; // доступные суммы ставок
const MAX_CONSCIENCE = 100; // предел совести, при достижении — поражение
const PHRASE_COST_RATE = 0.1; // доля текущих денег за клик по фразе совести

// Раскладка интерфейса
const BUTTON_WIDTH = 180; // ширина кнопки ставки
const BUTTON_HEIGHT = 64; // высота кнопки ставки
const BUTTON_GAP = 40; // расстояние между кнопками
const PHRASE_BASE_Y = 56; // отступ стека фраз от низа экрана
const PHRASE_STEP = 38; // вертикальный шаг между фразами
const PHRASE_MAX = 6; // максимум одновременно видимых фраз

// Фразы совести, появляющиеся после каждой ставки
const CONSCIENCE_PHRASES = [
  'Ты делаешь ставку на чужую беду…',
  'А если бы это была твоя семья?',
  'Люди — не лотерея.',
  'Ты же знаешь, чем это закончится.',
  'Стыдно. Очень стыдно.',
  'Каждая монета здесь пахнет чужими слезами.',
  'Ты ещё можешь остановиться.',
  'Совесть не спит.',
  'Кто так поступает с людьми?',
  'Они тоже хотели жить спокойно.',
];

/** Форматирует число с разделителями разрядов, например 10 000. */
function formatMoney(value: number): string {
  return Math.floor(value).toLocaleString('ru-RU');
}

/**
 * Игра «Ставка и совесть».
 * Игрок — должник. Ставками зарабатывает на погашение долга,
 * но каждая ставка растит совесть, которая мешает зарабатывать.
 */
export class GameScene extends Phaser.Scene {
  // Состояние игры
  private money = START_MONEY; // текущие деньги
  private debt = DEBT; // оставшийся долг (для победы money >= debt)
  private conscience = 0; // уровень совести: 0..MAX_CONSCIENCE
  private gameOver = false; // игра завершена — ставки заблокированы

  // Тексты интерфейса
  private moneyText!: Phaser.GameObjects.Text;
  private debtText!: Phaser.GameObjects.Text;
  private conscienceText!: Phaser.GameObjects.Text;
  private resultText!: Phaser.GameObjects.Text;

  // Кнопки ставок и видимые фразы совести
  private betButtons: Phaser.GameObjects.Rectangle[] = [];
  private phrases: Phaser.GameObjects.Text[] = [];

  constructor() {
    super('GameScene');
  }

  create(): void {
    const { width, height } = this.scale;

    // Сброс состояния: scene.restart() не пересоздаёт экземпляр класса,
    // поэтому все поля нужно вернуть к начальным значениям вручную
    this.money = START_MONEY;
    this.debt = DEBT;
    this.conscience = 0;
    this.gameOver = false;
    this.betButtons = [];
    this.phrases = [];

    // Заголовок игры
    this.add
      .text(width / 2, 28, 'СТАВКА И СОВЕСТЬ', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '30px',
        fontStyle: 'bold',
        color: '#f8fafc',
      })
      .setOrigin(0.5, 0);

    // Верхняя панель: текущие деньги и долг
    this.moneyText = this.add.text(32, 84, '', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '24px',
      color: '#4ade80',
    });

    this.debtText = this.add
      .text(width - 32, 84, '', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '24px',
        color: '#f87171',
      })
      .setOrigin(1, 0);

    // Индикатор совести
    this.conscienceText = this.add
      .text(width / 2, 118, '', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '18px',
        color: '#fca5a5',
      })
      .setOrigin(0.5);

    // Результат последней ставки или клика по фразе
    this.resultText = this.add
      .text(width / 2, 158, '', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '22px',
        fontStyle: 'bold',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    // Подсказка
    this.add
      .text(
        width / 2,
        208,
        'Сделай ставку и погаси долг. Фразы совести убирай кликом — это стоит 10% денег.',
        {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '16px',
          color: '#94a3b8',
        },
      )
      .setOrigin(0.5);

    this.createBetButtons();

    // Первичная отрисовка состояния
    this.updateUI();
  }

  /** Создаёт три кнопки ставок в ряд по центру экрана. */
  private createBetButtons(): void {
    const { width } = this.scale;
    const y = 320; // высота ряда кнопок
    const totalWidth = BETS.length * BUTTON_WIDTH + (BETS.length - 1) * BUTTON_GAP;
    const startX = (width - totalWidth) / 2;

    BETS.forEach((amount, index) => {
      const x = startX + index * (BUTTON_WIDTH + BUTTON_GAP) + BUTTON_WIDTH / 2;

      const rect = this.add.rectangle(x, y, BUTTON_WIDTH, BUTTON_HEIGHT, 0x334155, 0.9);
      rect.setStrokeStyle(2, 0x64748b);

      this.add
        .text(x, y, `Ставка ${formatMoney(amount)}`, {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '20px',
          color: '#f8fafc',
        })
        .setOrigin(0.5);

      // Подсветка при наведении и обработчик клика
      rect.setInteractive({ useHandCursor: true });
      rect.on('pointerover', () => rect.setFillStyle(0x475569, 0.9));
      rect.on('pointerout', () => rect.setFillStyle(0x334155, 0.9));
      rect.on('pointerdown', () => this.makeBet(amount));

      this.betButtons.push(rect);
    });
  }

  /** Обрабатывает ставку: списание, исход, рост совести, обновление UI. */
  private makeBet(amount: number): void {
    // Игра завершена или денег не хватает — ставка невозможна
    if (this.gameOver || amount > this.money) return;

    this.money -= amount;

    // Мгновенный исход: с шансом WIN_CHANCE игрок получает сумму x2
    if (Phaser.Math.FloatBetween(0, 1) < WIN_CHANCE) {
      this.money += amount * 2;
      this.resultText.setText(`Выигрыш +${formatMoney(amount * 2)}`);
      this.resultText.setColor('#4ade80');
    } else {
      this.resultText.setText(`Проигрыш -${formatMoney(amount)}`);
      this.resultText.setColor('#f87171');
    }

    // Каждая ставка растит совесть пропорционально сумме
    this.conscience = Math.min(MAX_CONSCIENCE, this.conscience + amount / 100);

    this.showConsciencePhrase();
    this.updateUI();
    this.checkEnd();
  }

  /** Добавляет новую фразу совести в стек снизу экрана. */
  private showConsciencePhrase(): void {
    const phrase = Phaser.Utils.Array.GetRandom(CONSCIENCE_PHRASES);

    const text = this.add
      .text(this.scale.width / 2, this.scale.height - PHRASE_BASE_Y, phrase, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '22px',
        fontStyle: 'bold',
        color: '#ffffff',
        backgroundColor: '#7f1d1d',
        padding: { x: 12, y: 6 },
        wordWrap: { width: 760 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    // Клик по фразе: убрать её, заплатив 10% текущих денег
    text.on('pointerdown', () => this.removePhrase(text));

    this.phrases.push(text);

    // Не даём стеку выйти за экран: самая старая фраза исчезает
    if (this.phrases.length > PHRASE_MAX) {
      const oldest = this.phrases.shift();
      if (oldest) oldest.destroy();
    }

    this.reflowPhrases();
  }

  /** Пересчитывает позиции и размеры фраз: последняя — крупная, старые — мелкие. */
  private reflowPhrases(): void {
    const startY = this.scale.height - PHRASE_BASE_Y;

    this.phrases.forEach((text, index) => {
      const isLast = index === this.phrases.length - 1;
      text.setFontSize(isLast ? 22 : 15);
      text.setAlpha(isLast ? 1 : 0.55);
      text.y = startY - (this.phrases.length - 1 - index) * PHRASE_STEP;
    });
  }

  /** Убирает фразу за 10% текущих денег (минимум 1). */
  private removePhrase(text: Phaser.GameObjects.Text): void {
    if (this.gameOver) return;

    const cost = Math.max(1, Math.floor(this.money * PHRASE_COST_RATE));
    this.money -= cost;

    this.resultText.setText(`Совесть отняла ${formatMoney(cost)}`);
    this.resultText.setColor('#fbbf24');

    this.phrases = this.phrases.filter((item) => item !== text);
    text.destroy();
    this.reflowPhrases();

    this.updateUI();
    this.checkEnd();
  }

  /** Обновляет тексты, доступность кнопок и цвет фона. */
  private updateUI(): void {
    this.moneyText.setText(`Деньги: ${formatMoney(this.money)}`);
    this.debtText.setText(`Долг: ${formatMoney(this.debt)}`);
    this.conscienceText.setText(`Совесть: ${Math.round(this.conscience)} / ${MAX_CONSCIENCE}`);

    // Кнопки, которые нельзя оплатить, затемняются
    this.betButtons.forEach((rect, index) => {
      const affordable = BETS[index] <= this.money && !this.gameOver;
      rect.setAlpha(affordable ? 1 : 0.35);
    });

    // Фон краснеет по мере роста совести
    const t = this.conscience / MAX_CONSCIENCE;
    const from = Phaser.Display.Color.ValueToColor(0x2d0a0a); // тёмно-красный
    const to = Phaser.Display.Color.ValueToColor(0xb91c1c); // ярко-красный
    const color = Phaser.Display.Color.Interpolate.ColorWithColor(
      from,
      to,
      100,
      Math.round(t * 100),
    );
    this.cameras.main.setBackgroundColor(
      Phaser.Display.Color.GetColor(color.r, color.g, color.b),
    );
  }

  /** Проверяет условия победы и поражения. */
  private checkEnd(): void {
    if (this.gameOver) return;

    if (this.money <= 0) {
      this.endGame('Ты банкрот. Долг остался с тобой.');
    } else if (this.conscience >= MAX_CONSCIENCE) {
      this.endGame('Совесть задушила тебя.');
    } else if (this.money >= this.debt) {
      this.endGame('Долг погашен. Ты свободен.');
    }
  }

  /** Показывает финальный экран с кнопкой перезапуска. */
  private endGame(message: string): void {
    this.gameOver = true;

    const { width, height } = this.scale;

    // Затемнение поверх игры
    this.add
      .rectangle(width / 2, height / 2, width, height, 0x000000, 0.72)
      .setDepth(100);

    this.add
      .text(width / 2, height / 2 - 70, message, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '34px',
        fontStyle: 'bold',
        color: '#ffffff',
        align: 'center',
        wordWrap: { width: 720 },
      })
      .setOrigin(0.5)
      .setDepth(101);

    // Кнопка «Начать заново» перезапускает сцену
    const restartButton = this.add
      .rectangle(width / 2, height / 2 + 90, 260, 60, 0x1e293b, 1)
      .setStrokeStyle(2, 0x64748b)
      .setDepth(102);

    this.add
      .text(width / 2, height / 2 + 90, 'Начать заново', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '22px',
        color: '#f8fafc',
      })
      .setOrigin(0.5)
      .setDepth(103);

    restartButton.setInteractive({ useHandCursor: true });
    restartButton.on('pointerdown', () => this.scene.restart());
  }
}
