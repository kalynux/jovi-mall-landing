# Phone numbers

Every phone number the app collects goes through this module and through
[`PhoneField`](../../components/ui/PhoneField.tsx). Nothing else should parse,
format or validate a phone number.

## The value contract

A phone field stores **one string**, always international:

| state | stored value |
| --- | --- |
| untouched | `""` |
| mid-typing (CM) | `"+237670"` |
| complete (CM) | `"+237670000000"` — valid E.164 |

The value is E.164 exactly when the number is valid, and a prefix of it
otherwise. Display grouping (`6 70 00 00 00`) is local UI state and never part
of the value.

## Using it in a form

```tsx
const { control, formState: { errors } } = useForm({
  resolver: zodResolver(z.object({ phone: PhoneSchema })),
  defaultValues: { phone: "" },
});

<Controller
  name="phone"
  control={control}
  render={({ field }) => (
    <PhoneField
      label={t("phoneLabel")}
      required
      value={field.value}
      onChange={field.onChange}
      onBlur={field.onBlur}
      name={field.name}
      inputRef={field.ref}
      error={errors.phone?.message}
    />
  )}
/>
```

`PhoneSchema` both validates and **transforms the parsed output to strict
E.164**, so `handleSubmit` data is already normalised. Values that fail
validation never reach `onSubmit`.

For a field that may be left blank use `OptionalPhoneSchema` (empty →
`undefined`; anything typed must be complete).

## Error messages

Validation failures are stable codes (`phone.errors.tooShort`), not sentences.
`PhoneField` renders its own; if you need to render one yourself — a backend
field error, say — pass it through `usePhoneErrorText()`, which translates our
codes and passes anything else straight through.

Add new wording to the `phone` namespace in every file under `messages/`.

## Default country

`usePreferredCountry()` resolves, in order:

1. `role_entity.country` — set during onboarding (BASIC_SETUP step 1).
2. The last country the user explicitly picked, from `localStorage`.
3. `DEFAULT_COUNTRY` (`CM`), matching the backend default.

`PhoneField` adopts a late-resolving preferred country only while the field is
still empty and untouched, so it never overwrites what someone has typed.

## Regenerating country metadata

`countries.generated.ts` is baked at author time from libphonenumber-js
metadata and ICU region names — see the header comment in that file for why.
After upgrading `libphonenumber-js`:

```bash
npm run gen:phone-countries
```
