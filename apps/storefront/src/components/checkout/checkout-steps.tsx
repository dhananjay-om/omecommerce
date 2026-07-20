const STEPS = ['Shipping', 'Billing', 'Delivery', 'Payment', 'Review'];

export function CheckoutSteps({ current }: { current: number }) {
  return (
    <ol className="mb-8 flex items-center gap-2 overflow-x-auto text-sm">
      {STEPS.map((label, i) => {
        const step = i + 1;
        const state = step === current ? 'current' : step < current ? 'done' : 'upcoming';
        return (
          <li key={label} className="flex shrink-0 items-center gap-2">
            <span
              className={`flex size-6 items-center justify-center rounded-full text-xs font-semibold ${
                state === 'current'
                  ? 'bg-primary text-primary-foreground'
                  : state === 'done'
                    ? 'bg-success text-success-foreground'
                    : 'bg-muted text-muted-foreground'
              }`}
            >
              {step}
            </span>
            <span className={state === 'upcoming' ? 'text-muted-foreground' : 'font-medium'}>{label}</span>
            {step < STEPS.length ? <span className="text-muted-foreground">/</span> : null}
          </li>
        );
      })}
    </ol>
  );
}
