import { css } from '@emotion/css';
import { dateTimeFormatISO, GrafanaTheme2, LoadingState } from '@grafana/data';
import { Alert, Button, HorizontalGroup, useStyles2 } from '@grafana/ui';
import React, { useCallback, useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { useMountedState } from 'react-use';
import { takeWhile } from 'rxjs/operators';
import { previewAlertRule } from '../../api/preview';
import { useAlertQueriesStatus } from '../../hooks/useAlertQueriesStatus';
import { PreviewRuleRequest, PreviewRuleResponse } from '../../types/preview';
import { RuleFormType, RuleFormValues } from '../../types/rule-form';
import { PreviewRuleResult } from './PreviewRuleResult';

const fields: Array<keyof RuleFormValues> = ['type', 'dataSourceName', 'condition', 'queries', 'expression'];

export function PreviewRule(): React.ReactElement | null {
  const styles = useStyles2(getStyles);
  const [preview, onPreview] = usePreview();
  const { watch } = useFormContext<RuleFormValues>();
  const [type, condition, queries] = watch(['type', 'condition', 'queries']);
  const { allDataSourcesAvailable } = useAlertQueriesStatus(queries);

  if (type === RuleFormType.cloudRecording || type === RuleFormType.cloudAlerting) {
    return null;
  }

  const isPreviewAvailable = Boolean(condition) && allDataSourcesAvailable;

  return (
    <div className={styles.container}>
      <HorizontalGroup>
        {allDataSourcesAvailable && (
          <Button disabled={!isPreviewAvailable} type="button" variant="primary" onClick={onPreview}>
            Preview alerts
          </Button>
        )}
        {!allDataSourcesAvailable && (
          <Alert title="Preview is not available" severity="warning">
            Cannot display the query preview. Some of the data sources used in the queries are not available.
          </Alert>
        )}
      </HorizontalGroup>
      <PreviewRuleResult preview={preview} />
    </div>
  );
}

function usePreview(): [PreviewRuleResponse | undefined, () => void] {
  const [preview, setPreview] = useState<PreviewRuleResponse | undefined>();
  const { getValues } = useFormContext<RuleFormValues>();
  const isMounted = useMountedState();

  const onPreview = useCallback(() => {
    const values = getValues(fields);
    const request = createPreviewRequest(values);

    previewAlertRule(request)
      .pipe(takeWhile((response) => !isCompleted(response), true))
      .subscribe((response) => {
        if (!isMounted()) {
          return;
        }
        setPreview(response);
      });
  }, [getValues, isMounted]);

  return [preview, onPreview];
}

function createPreviewRequest(values: any[]): PreviewRuleRequest {
  const [type, dataSourceName, condition, queries, expression] = values;

  switch (type) {
    case RuleFormType.cloudAlerting:
      return {
        dataSourceName,
        expr: expression,
      };

    case RuleFormType.grafana:
      return {
        grafana_condition: {
          condition,
          data: queries,
          now: dateTimeFormatISO(Date.now()),
        },
      };

    default:
      throw new Error(`Alert type ${type} not supported by preview.`);
  }
}

function isCompleted(response: PreviewRuleResponse): boolean {
  switch (response.data.state) {
    case LoadingState.Done:
    case LoadingState.Error:
      return true;
    default:
      return false;
  }
}

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css`
      margin-top: ${theme.spacing(2)};
      max-width: ${theme.breakpoints.values.xxl}px;
    `,
  };
}
