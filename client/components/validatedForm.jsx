"use client";

import { createContext, useContext, useId, useImperativeHandle, useRef } from 'react';
import { useFormik } from 'formik';
import { flushSync } from 'react-dom';
import { fieldKey, fieldValue, formFields, formValues, validateFields } from '@/lib/fieldValidation';

const ValidationContext = createContext(null);
export function useFormValidation() { return useContext(ValidationContext); }

// Keep existing request handlers and controlled domain state while Formik owns
// validation, touched errors and submission gating for every native field.
export function Form({ children, onSubmit, onChangeCapture, onBlurCapture, ref: forwardedRef, ...props }) {
  const formRef = useRef(null), submitting = useRef(false), submission = useRef(null);
  useImperativeHandle(forwardedRef, () => formRef.current);
  const formik = useFormik({ initialValues: {}, validateOnBlur: true, validateOnChange: true, validate: () => formRef.current ? validateFields(formFields(formRef.current), formValues(formRef.current)) : {}, onSubmit: async () => onSubmit?.(submission.current) });
  function sync() { if (formRef.current) return formik.setValues(formValues(formRef.current)); }
  async function submit(event) {
    event.preventDefault();
    if (submitting.current) return;
    const form = event.currentTarget, nativeEvent = event.nativeEvent, values = formValues(form);
    submitting.current = true;
    try {
      submission.current = { ...event, currentTarget: form, target: form, nativeEvent, preventDefault() {}, stopPropagation() { event.stopPropagation(); } };
      // Include untouched/default, file and dynamically mounted fields in Formik's
      // submission values before it marks every field touched and validates.
      flushSync(() => formik.setValues(values, false));
      await formik.submitForm();
      const errors = await formik.validateForm();
      if (Object.keys(errors).length) {
        const invalid = formFields(form).find(element => errors[fieldKey(element)] && element.type !== 'hidden');
        if (invalid) { const details = invalid.closest('details'); if (details) details.open = true; invalid.focus(); }
      }
    } finally { submitting.current = false; formik.setSubmitting(false); }
  }
  return <ValidationContext.Provider value={formik}><form {...props} noValidate ref={formRef} onSubmit={submit} onChangeCapture={event => { sync(); onChangeCapture?.(event); }} onBlurCapture={event => { const key = fieldKey(event.target); if (key) { formik.setFieldTouched(key, true, false); sync(); } onBlurCapture?.(event); }}>{children}</form></ValidationContext.Provider>;
}
function Control({ tag: Tag, formik, validationKey, ...props }) {
  const generatedId = useId(), key = validationKey || props.name || props.id || generatedId;
  const error = formik.touched[key] && formik.errors[key], errorId = `${props.id || generatedId}-validation`;
  return <><Tag {...props} data-validation-key={key} aria-invalid={error ? true : props['aria-invalid']} aria-describedby={[props['aria-describedby'], error ? errorId : null].filter(Boolean).join(' ') || undefined} />{error && props.type !== 'hidden' && <span id={errorId} role="alert" className="mt-2 block text-[13px] font-normal leading-relaxed text-danger-text [overflow-wrap:anywhere]">{error}</span>}</>;
}
function StandaloneControl({ tag, ...props }) {
  const elementRef = useRef(null), generatedId = useId(), key = props.name || props.id || generatedId;
  const formik = useFormik({ initialValues: { [key]: props.value ?? props.defaultValue ?? '' }, validate: values => elementRef.current ? validateFields([elementRef.current], values) : {}, onSubmit: () => {} });
  const { ref: forwardedRef, onChange, onBlur, ...rest } = props;
  useImperativeHandle(forwardedRef, () => elementRef.current);
  function sync(element, touched) { const value = fieldValue(element); formik.setFieldValue(key, value); if (touched) formik.setFieldTouched(key, true); }
  return <Control {...rest} tag={tag} formik={formik} ref={elementRef} validationKey={key} onChange={event => { sync(event.target, false); onChange?.(event); }} onBlur={event => { sync(event.target, true); onBlur?.(event); }} />;
}
function Field(props) { const formik = useContext(ValidationContext); return formik ? <Control {...props} formik={formik} /> : <StandaloneControl {...props} />; }
export function Input(props) { return <Field {...props} tag="input" />; }
export function Select(props) { return <Field {...props} tag="select" />; }
export function Textarea(props) { return <Field {...props} tag="textarea" />; }
