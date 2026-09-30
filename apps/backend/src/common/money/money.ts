/**
 * Money is always integer halalas (1 SAR = 100 halalas). Never floats.
 * See backend/md/03-domain-model.md and 05-api-conventions.md §4.
 */
export interface MoneyDto {
  amount: number; // halalas
  currency: 'SAR';
  formatted: string;
}

export class Money {
  private constructor(readonly halalas: number) {
    if (!Number.isInteger(halalas)) {
      throw new Error(`Money must be an integer number of halalas, got ${halalas}`);
    }
  }

  static fromHalalas(halalas: number): Money {
    return new Money(halalas);
  }

  static fromSar(sar: number): Money {
    return new Money(Math.round(sar * 100));
  }

  static zero(): Money {
    return new Money(0);
  }

  add(other: Money): Money {
    return new Money(this.halalas + other.halalas);
  }

  subtract(other: Money): Money {
    return new Money(this.halalas - other.halalas);
  }

  /** VAT at `rateBps` basis points (1500 = 15%), rounded half-up to the halala. */
  vat(rateBps: number): Money {
    return new Money(Math.round((this.halalas * rateBps) / 10000));
  }

  toDto(locale: 'ar' | 'en' = 'ar'): MoneyDto {
    const sar = this.halalas / 100;
    const formatted = new Intl.NumberFormat(locale === 'ar' ? 'ar-SA' : 'en-SA', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(sar);
    return { amount: this.halalas, currency: 'SAR', formatted: `${formatted} SAR` };
  }
}
