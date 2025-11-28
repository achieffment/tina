'use client';
import React, { useState, useEffect } from 'react';
import { useCMS, FormMetaPlugin } from 'tinacms';
import { LOCALES, DEFAULT_LOCALE, type LocaleCode } from '@/lib/locales';

interface ExistingTranslation {
  locale: string;
  path: string;
  exists: boolean;
}

// Компонент кнопки перевода для левой панели
const TranslateButton: React.FC = () => {
  const cms = useCMS();
  const [status, setStatus] = useState<string>('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [existingTranslations, setExistingTranslations] = useState<ExistingTranslation[]>([]);
  const [selectedLocales, setSelectedLocales] = useState<Set<LocaleCode>>(new Set());
  const [currentLocale, setCurrentLocale] = useState<string>('');
  const [collection, setCollection] = useState<string>('');
  const [relativePath, setRelativePath] = useState<string>('');
  const [isSelectExpanded, setIsSelectExpanded] = useState<boolean>(false);

  // Загружаем информацию о существующих переводах при монтировании
  useEffect(() => {
    const loadTranslations = async () => {
      try {
        if (!cms) return;

        const activeForms = cms.state.forms || [];
        if (activeForms.length === 0) return;

        const form = activeForms[0].tinaForm;
        if (!form) return;

        const formId = form.id || '';
        const pathMatch = formId.match(/^content\/(pages|posts|services)\/(.+)$/);
        
        if (!pathMatch) return;
        
        const collectionPlural = pathMatch[1];
        const relPath = pathMatch[2];
        
        const collectionMap: Record<string, string> = {
          'pages': 'page',
          'posts': 'post',
          'services': 'service'
        };
        
        const coll = collectionMap[collectionPlural];
        if (!coll) return;

        setCollection(coll);
        setRelativePath(relPath);

        // Извлекаем текущую локаль
        const currentLoc = relPath.split('/')[0];
        setCurrentLocale(currentLoc);

        // Запрашиваем существующие переводы
        const response = await fetch('/api/check-translations', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            collection: coll,
            relativePath: relPath,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          setExistingTranslations(data.translations || []);
        }
      } catch (error) {
        console.error('Error loading translations:', error);
      }
    };

    loadTranslations();
  }, [cms]);

  // Функция для перевода одного языка (без создания файла)
  const translateSingleLocale = async (
    targetLocale: LocaleCode,
    currentValues: any,
    filePathWithoutLocale: string,
    localeIndex: number,
    totalLocales: number
  ): Promise<{ success: boolean; locale: LocaleCode; translatedDocument?: any; relativePath?: string }> => {
    const localeStartTime = Date.now();
    
    console.log('\n' + '-'.repeat(60));
    console.log(`[TRANSLATE:UI] Язык ${localeIndex}/${totalLocales}: ${LOCALES[targetLocale].nativeName} (${targetLocale})`);
    console.log('-'.repeat(60));
    
    try {
      // Перевод документа
      const translateStartTime = Date.now();
      console.log('[TRANSLATE:UI] Отправка документа на перевод');
      
      const response = await fetch('/api/translate-document', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          document: currentValues,
          targetLocale,
          sourceLocale: currentLocale,
          collection,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('[TRANSLATE:UI] Ошибка API перевода:', error);
        throw new Error(error.error || 'Translation failed');
      }

      const { translatedDocument } = await response.json();
      const translateDuration = Date.now() - translateStartTime;
      const localeDuration = Date.now() - localeStartTime;
      
      console.log('[TRANSLATE:UI] ✓ Перевод завершен за', translateDuration, 'ms');
      console.log('[TRANSLATE:UI] ✅ Язык обработан успешно за', localeDuration, 'ms');
      
      const newRelativePath = `${targetLocale}/${filePathWithoutLocale}`;
      
      return { 
        success: true, 
        locale: targetLocale,
        translatedDocument,
        relativePath: newRelativePath,
      };
      
    } catch (error) {
      const localeDuration = Date.now() - localeStartTime;
      console.error('[TRANSLATE:UI] ❌ Ошибка перевода на', targetLocale, 'после', localeDuration, 'ms:', error);
      return { success: false, locale: targetLocale };
    }
  };

  const handleTranslate = async () => {
    if (selectedLocales.size === 0) {
      setStatus('❌ Выберите хотя бы один язык для перевода');
      return;
    }

    const overallStartTime = Date.now();
    console.log('='.repeat(60));
    console.log('[TRANSLATE:UI] 🌐 НАЧАЛО ПРОЦЕССА ПЕРЕВОДА (ПАРАЛЛЕЛЬНЫЙ РЕЖИМ)');
    console.log('[TRANSLATE:UI] Параметры:', {
      sourceLocale: currentLocale,
      targetLocales: Array.from(selectedLocales),
      collection,
      relativePath,
      parallelBatchSize: 4,
      timestamp: new Date().toISOString(),
    });
    console.log('='.repeat(60));

    setIsTranslating(true);
    setStatus('Получение данных...');

    try {
      if (!cms) {
        throw new Error('CMS not available');
      }

      const stepStartTime = Date.now();
      console.log('[TRANSLATE:UI] Шаг 1: Получение данных формы');

      // Получаем активную форму
      const activeForms = cms.state.forms || [];
      if (activeForms.length === 0) {
        throw new Error('No document is currently being edited');
      }

      const form = activeForms[0].tinaForm;
      if (!form) {
        throw new Error('Cannot access current form');
      }

      // Получаем текущие значения формы
      const currentValues = form.finalForm.getState().values;
      
      const relativePathParts = relativePath.split('/');
      const filePathWithoutLocale = relativePathParts.slice(1).join('/');
      
      console.log('[TRANSLATE:UI] Данные получены за', Date.now() - stepStartTime, 'ms');
      console.log('[TRANSLATE:UI] Структура документа:', {
        fields: Object.keys(currentValues),
        collection,
      });

      const translatedFiles: any[] = [];
      const failedLocales: string[] = [];

      // Разбиваем языки на батчи по 4 для параллельного перевода
      const localesArray = Array.from(selectedLocales);
      const batchSize = 4;
      const batches: LocaleCode[][] = [];
      
      for (let i = 0; i < localesArray.length; i += batchSize) {
        batches.push(localesArray.slice(i, i + batchSize));
      }

      console.log(`[TRANSLATE:UI] Обработка ${localesArray.length} языков в ${batches.length} батчах (по ${batchSize} параллельно)`);

      // Переводим все языки (без создания файлов)
      let processedCount = 0;
      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        const batchStartTime = Date.now();
        
        console.log('\n' + '='.repeat(60));
        console.log(`[TRANSLATE:UI] 📦 БАТЧ ${batchIndex + 1}/${batches.length}: ${batch.length} языков параллельно`);
        console.log('[TRANSLATE:UI] Языки:', batch.map(loc => LOCALES[loc].nativeName).join(', '));
        console.log('='.repeat(60));

        // Обновляем статус для текущего батча
        const batchLocaleNames = batch.map(loc => LOCALES[loc].nativeName).join(', ');
        setStatus(`Перевод (батч ${batchIndex + 1}/${batches.length}): ${batchLocaleNames}...`);

        // Переводим все языки в батче параллельно
        const batchPromises = batch.map((locale, indexInBatch) => 
          translateSingleLocale(
            locale,
            currentValues,
            filePathWithoutLocale,
            processedCount + indexInBatch + 1,
            localesArray.length
          )
        );

        const batchResults = await Promise.all(batchPromises);
        
        // Накапливаем переводы и ошибки
        for (const result of batchResults) {
          if (result.success && result.translatedDocument && result.relativePath) {
            translatedFiles.push({
              locale: result.locale,
              relativePath: result.relativePath,
              collection,
              document: result.translatedDocument,
            });
          } else {
            failedLocales.push(result.locale);
          }
        }
        
        processedCount += batch.length;
        const batchDuration = Date.now() - batchStartTime;
        
        console.log(`[TRANSLATE:UI] ✅ Батч ${batchIndex + 1} завершен за ${batchDuration}ms`);
        console.log(`[TRANSLATE:UI] Прогресс: ${processedCount}/${localesArray.length} языков обработано`);
      }
      
      // Создаём все файлы одним batch коммитом
      if (translatedFiles.length > 0) {
        console.log('\n' + '='.repeat(60));
        console.log('[TRANSLATE:UI] 💾 СОЗДАНИЕ ФАЙЛОВ И КОММИТА');
        console.log('[TRANSLATE:UI] Файлов для создания:', translatedFiles.length);
        console.log('='.repeat(60));
        
        setStatus(`Создание файлов и коммита для ${translatedFiles.length} языков...`);
        
        const createFilesStartTime = Date.now();
        
        const batchResponse = await fetch('/api/create-translated-files-batch', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            files: translatedFiles,
            sourceLocale: currentLocale,
            sourceDocumentPath: relativePath,
          }),
        });
        
        if (!batchResponse.ok) {
          const error = await batchResponse.json();
          console.error('[TRANSLATE:UI] Ошибка batch создания файлов:', error);
          throw new Error(error.error || 'Failed to create files');
        }
        
        const batchResult = await batchResponse.json();
        const createFilesDuration = Date.now() - createFilesStartTime;
        
        console.log('[TRANSLATE:UI] ✓ Все файлы созданы за', createFilesDuration, 'ms');
        console.log('[TRANSLATE:UI] ✓ Метод:', batchResult.method);
        console.log('[TRANSLATE:UI] ✓ Закоммичено:', batchResult.committed ? 'Да' : 'Нет');
      }
      
      const overallDuration = Date.now() - overallStartTime;
      
      console.log('\n' + '='.repeat(60));
      console.log('[TRANSLATE:UI] 🏁 ПЕРЕВОД ЗАВЕРШЕН');
      console.log('[TRANSLATE:UI] Общая статистика:', {
        totalDuration: overallDuration + 'ms',
        successCount: translatedFiles.length,
        failedCount: failedLocales.length,
        totalLocales: selectedLocales.size,
        avgTimePerLocale: Math.round(overallDuration / selectedLocales.size) + 'ms',
      });
      
      if (translatedFiles.length > 0) {
        const successLocales = translatedFiles.map((f: any) => LOCALES[f.locale as LocaleCode].nativeName);
        console.log('[TRANSLATE:UI] ✅ Успешно:', successLocales.join(', '));
      }
      if (failedLocales.length > 0) {
        console.log('[TRANSLATE:UI] ❌ Ошибки:', failedLocales.map(loc => LOCALES[loc as LocaleCode].nativeName).join(', '));
      }
      console.log('='.repeat(60));
      
      // Формируем итоговое сообщение
      let finalStatus = '';
      if (translatedFiles.length > 0) {
        const localeNames = translatedFiles.map((f: any) => LOCALES[f.locale as LocaleCode].nativeName).join(', ');
        finalStatus += `✅ Переведено на: ${localeNames}`;
      }
      if (failedLocales.length > 0) {
        const localeNames = failedLocales.map(loc => LOCALES[loc as LocaleCode].nativeName).join(', ');
        finalStatus += `\n❌ Ошибка: ${localeNames}`;
      }
      
      setStatus(finalStatus);
      setIsTranslating(false);
      setSelectedLocales(new Set()); // Сбрасываем выбор
      
      // Обновляем список существующих переводов
      setTimeout(async () => {
        const response = await fetch('/api/check-translations', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            collection,
            relativePath,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          setExistingTranslations(data.translations || []);
        }
      }, 1000);
      
    } catch (error) {
      const overallDuration = Date.now() - overallStartTime;
      console.error('='.repeat(60));
      console.error('[TRANSLATE:UI] ❌ КРИТИЧЕСКАЯ ОШИБКА после', overallDuration, 'ms');
      console.error('[TRANSLATE:UI] Ошибка:', error);
      console.error('='.repeat(60));
      setStatus(`❌ Ошибка: ${error instanceof Error ? error.message : 'Translation failed'}`);
      setIsTranslating(false);
    }
  };

  // Проверяем, открыт ли документ на основном языке (английском)
  const isDefaultLocale = currentLocale === DEFAULT_LOCALE;

  // Получаем список доступных языков (исключаем текущий и уже существующие)
  const existingLocales = new Set(existingTranslations.map(t => t.locale));
  const availableLocales = Object.keys(LOCALES).filter(
    locale => locale !== currentLocale && !existingLocales.has(locale)
  ) as LocaleCode[];

  const toggleLocale = (locale: LocaleCode) => {
    const newSet = new Set(selectedLocales);
    if (newSet.has(locale)) {
      newSet.delete(locale);
    } else {
      newSet.add(locale);
    }
    setSelectedLocales(newSet);
  };

  const toggleAllLocales = () => {
    if (selectedLocales.size === availableLocales.length) {
      // Если все выбраны - снимаем все
      setSelectedLocales(new Set());
    } else {
      // Выбираем все доступные
      setSelectedLocales(new Set(availableLocales));
    }
  };

  return (
    <div style={{
      padding: '12px 16px',
      backgroundColor: '#f9fafb',
      borderBottom: '1px solid #e5e7eb',
      marginBottom: '16px',
    }}>
      {/* Заголовок */}
      <div style={{
        fontSize: '13px',
        fontWeight: '600',
        color: '#374151',
        marginBottom: '12px',
      }}>
        🌐 Переводы документа
      </div>

      {/* Существующие переводы */}
      {existingTranslations.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <div style={{
            fontSize: '11px',
            color: '#6b7280',
            marginBottom: '8px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}>
            Доступные языки
          </div>
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '8px',
          }}>
            {existingTranslations.map(trans => {
              const localeInfo = LOCALES[trans.locale as LocaleCode];
              if (!localeInfo) return null;
              
              const isCurrentLocale = trans.locale === currentLocale;
              
              // Получаем путь документа без локали и без расширения .mdx
              // Например, "about.mdx" из "en/about.mdx" -> "about"
              const relativePathParts = relativePath.split('/');
              const documentPathWithExtension = relativePathParts.slice(1).join('/');
              const documentPath = documentPathWithExtension.replace(/\.mdx$/, '');
              
              // Формируем URL в зависимости от языка, сохраняя путь к документу
              let localeUrl: string;
              if (trans.locale === DEFAULT_LOCALE) {
                // Для основного языка: /admin/index.html#/~/about
                localeUrl = documentPath ? `/admin/index.html#/~/${documentPath}` : '/admin/index.html#/~/';
              } else {
                // Для других языков: /admin/index.html#/~/ru/about
                localeUrl = documentPath ? `/admin/index.html#/~/${trans.locale}/${documentPath}` : `/admin/index.html#/~/${trans.locale}`;
              }
              
              return (
                <a
                  key={trans.locale}
                  href={isCurrentLocale ? '#' : localeUrl}
                  onClick={(e) => {
                    if (isCurrentLocale) {
                      e.preventDefault();
                    }
                  }}
                  title={localeInfo.nativeName}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 10px',
                    backgroundColor: isCurrentLocale ? '#2296fe' : 'white',
                    color: isCurrentLocale ? 'white' : '#374151',
                    border: `1px solid ${isCurrentLocale ? '#2296fe' : '#d1d5db'}`,
                    borderRadius: '6px',
                    fontSize: '12px',
                    textDecoration: 'none',
                    cursor: isCurrentLocale ? 'default' : 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    if (!isCurrentLocale) {
                      e.currentTarget.style.borderColor = '#2296fe';
                      e.currentTarget.style.backgroundColor = '#eff6ff';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isCurrentLocale) {
                      e.currentTarget.style.borderColor = '#d1d5db';
                      e.currentTarget.style.backgroundColor = 'white';
                    }
                  }}
                >
                  <span style={{ fontSize: '16px' }}>{localeInfo.flag}</span>
                  <span style={{ fontWeight: '500' }}>{trans.locale.toUpperCase()}</span>
                </a>
              );
            })}
          </div>
        </div>
      )}

      {/* Выбор языков для перевода - только для основного языка */}
      {isDefaultLocale ? (
        <>
          {availableLocales.length > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <button
                onClick={() => setIsSelectExpanded(!isSelectExpanded)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  backgroundColor: 'white',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: '500',
                  color: '#374151',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  marginBottom: isSelectExpanded ? '12px' : '0',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#2296fe';
                  e.currentTarget.style.backgroundColor = '#f9fafb';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#d1d5db';
                  e.currentTarget.style.backgroundColor = 'white';
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>🌐</span>
                  <span>Выбрать языки для перевода</span>
                </span>
                <span style={{
                  transform: isSelectExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s',
                  fontSize: '12px',
                }}>
                  ▼
                </span>
              </button>

              {isSelectExpanded && (
                <div>
                  {/* Кнопка "Выбрать все / Снять все" */}
                  <button
                    onClick={toggleAllLocales}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      marginBottom: '8px',
                      backgroundColor: 'white',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: '500',
                      color: '#2296fe',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#eff6ff';
                      e.currentTarget.style.borderColor = '#2296fe';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'white';
                      e.currentTarget.style.borderColor = '#d1d5db';
                    }}
                  >
                    {selectedLocales.size === availableLocales.length ? '✓ Снять все' : 'Выбрать все'}
                  </button>

                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: '8px',
                  }}>
                    {availableLocales.map(locale => {
                      const localeInfo = LOCALES[locale];
                      const isSelected = selectedLocales.has(locale);
                      
                      return (
                        <label
                          key={locale}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '8px 10px',
                            backgroundColor: isSelected ? '#eff6ff' : 'white',
                            border: `1px solid ${isSelected ? '#2296fe' : '#d1d5db'}`,
                            borderRadius: '6px',
                            fontSize: '12px',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                          }}
                          onMouseEnter={(e) => {
                            if (!isSelected) {
                              e.currentTarget.style.borderColor = '#93c5fd';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!isSelected) {
                              e.currentTarget.style.borderColor = '#d1d5db';
                            }
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleLocale(locale)}
                            style={{
                              width: '16px',
                              height: '16px',
                              cursor: 'pointer',
                              accentColor: '#2296fe',
                            }}
                          />
                          <span style={{ fontSize: '16px' }}>{localeInfo.flag}</span>
                          <span style={{ fontWeight: '500', flex: 1 }}>
                            {localeInfo.nativeName}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Кнопка перевода */}
          <button
            onClick={handleTranslate}
            disabled={isTranslating || selectedLocales.size === 0}
            style={{
              width: '100%',
              padding: '10px 16px',
              backgroundColor: isTranslating || selectedLocales.size === 0 ? '#9ca3af' : '#2296fe',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: isTranslating || selectedLocales.size === 0 ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
          >
            <span style={{ fontSize: '16px' }}>🌐</span>
            <span>
              {isTranslating 
                ? 'Перевод...' 
                : selectedLocales.size > 0
                ? `Перевести (${selectedLocales.size})`
                : 'Выберите языки'
              }
            </span>
          </button>
        </>
      ) : (
        <div style={{
          padding: '12px',
          backgroundColor: '#fef3c7',
          border: '1px solid #fbbf24',
          borderRadius: '6px',
          fontSize: '12px',
          color: '#92400e',
          lineHeight: '1.5',
        }}>
          <strong>ℹ️ Информация:</strong><br />
          Переводы создаются только с английской версии документа. 
          Откройте английскую версию для добавления новых переводов.
        </div>
      )}

      {/* Статус */}
      {status && (
        <div style={{
          marginTop: '12px',
          padding: '10px 12px',
          backgroundColor: status.includes('❌') ? '#fee2e2' : status.includes('✅') ? '#dcfce7' : '#dbeafe',
          borderRadius: '6px',
          fontSize: '13px',
          color: status.includes('❌') ? '#991b1b' : status.includes('✅') ? '#166534' : '#1e40af',
          whiteSpace: 'pre-line',
        }}>
          {status}
        </div>
      )}
    </div>
  );
};

// Создаём FormMetaPlugin для отображения кнопки в левой панели
export const TranslateFormMetaPlugin = new FormMetaPlugin({
  name: 'translate-document',
  Component: TranslateButton,
});

// Функция для добавления плагина в CMS
export const addTranslateButton = (cms: any) => {
  console.log('🌐 Adding Translate Button to TinaCMS sidebar');
  
  cms.plugins.add(TranslateFormMetaPlugin);
  console.log('✅ Translate Button added successfully');
  
  return cms;
};
