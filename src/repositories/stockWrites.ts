let pendingWrites = 0;
let resetInProgress = false;

// Some stock changes span several SQL calls, including creating a product with initial stock.
export function trackStockWrite<Args extends unknown[], Result>(
  write: (...args: Args) => Promise<Result>,
) {
  return async (...args: Args): Promise<Result> => {
    if (resetInProgress) throw new Error('Reset stok sedang diproses.');

    pendingWrites += 1;
    try {
      return await write(...args);
    } finally {
      pendingWrites -= 1;
    }
  };
}

export async function runStockReset<Result>(reset: () => Promise<Result>): Promise<Result> {
  if (resetInProgress) throw new Error('Reset stok sedang diproses.');
  if (pendingWrites > 0) {
    throw new Error('Penyimpanan data sedang berlangsung. Tunggu sampai selesai, lalu coba lagi.');
  }

  resetInProgress = true;
  try {
    return await reset();
  } finally {
    resetInProgress = false;
  }
}
