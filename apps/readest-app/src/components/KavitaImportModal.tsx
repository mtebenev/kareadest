import React, { useState } from 'react';

import { Book } from '@/types/book';
import { useEnv } from '@/context/EnvContext';
import { useSettingsStore } from '@/store/settingsStore';
import { useTranslation } from '@/hooks/useTranslation';
import Dialog from './Dialog';

interface KavitaImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  doImport: () => void;
  handleBookDownload?: (book: Book) => void;
  handleBookUpload?: (book: Book) => void;
  handleBookDelete?: (book: Book) => void;
}

const KavitaImportModal = ({
  isOpen,
  onClose,
  doImport
}: KavitaImportModalProps) => {
  const _ = useTranslation();
  const [loading, setLoading] = useState(false);
  const [showDeleteAlert, setShowDeleteAlert] = useState(false);
  const [fileSize, setFileSize] = useState<number | null>(null);
  const { envConfig } = useEnv();
  const { settings } = useSettingsStore();
  const [books, setBooks] = useState<string[]>(['Book 1', 'Book 2', 'Book 3']);

  const handleClose = () => {
    onClose();
  };

  const handleDelete = () => {
    setShowDeleteAlert(true);
    };

  const handleGetBooks = async () => {
    console.log('MTEX Starting Kavita import...');

    const proxyBaseEndpoint = '/api/kavita-proxy';
    const apiKey = '<API_KEY>';

    const loginEndpoint = `${proxyBaseEndpoint}/api/Plugin/authenticate?apiKey=${apiKey}&pluginName=kareadest`;
    const loginResponse = await fetch(loginEndpoint, {
      method: 'POST',
      headers: {
      'Content-Type': 'application/json',
      },
    });

    const jwtToken = (await loginResponse.json()).token;
    console.log('MTEX got JWT Token:', jwtToken);

    // Fetch libraries
    const librariesEndpoint = `${proxyBaseEndpoint}/api/Library/libraries`;
    const librariesResponse = await fetch(librariesEndpoint, {
      headers: {
        'Authorization': `Bearer ${jwtToken}`,
        'Content-Type': 'application/json',
      },
    });
    const librariesData = await librariesResponse.json();
    console.log('MTEX libraries data:', librariesData);

    // Fetch books
    const seriesEndpoint = `${proxyBaseEndpoint}/api/Series/all-v2`;
    const seriesResponse = await fetch(seriesEndpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${jwtToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        "statements": [
        ],
        "combination": 1,
        "sortOptions": {
          "sortField": 1,
          "isAscending": true
        },
        "limitTo": 0
      }),
    });
    const seriesData = await seriesResponse.json();
    console.log('MTEX series data:', seriesData);

    // Download book
    const downloadEndpoint = `${proxyBaseEndpoint}/api/Download/series?seriesId=197`;
    const downloadResponse = await fetch(downloadEndpoint, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${jwtToken}`,
        'Content-Type': 'application/json',
      },
    });
    const downloadData = await downloadResponse.blob();
    console.log('MTEX download data:', downloadData.size);

    const fileName = 'downloaded_book.zip'; // You can set this dynamically if needed
    const file = new File([downloadData], fileName, { type: downloadData.type });


    doImport([file]);
  };

  const handleBookSelect = (book: string) => {
    console.log('Selected book:', book);
    // You can call a prop handler here if needed
  };

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center'>
      <Dialog
        title={_('Book Details')}
        isOpen={isOpen}
        onClose={handleClose}
        bgClassName='sm:bg-black/50'
        boxClassName='sm:min-w-[480px] sm:max-w-[480px] sm:h-auto sm:max-h-[90%]'
        contentClassName='!px-6 !py-2'
      >
        <div className='flex w-full select-text items-center justify-center'>
          <div className='relative w-full rounded-lg'>
            <div className='mb-6 me-4 flex h-32 items-start'>
              <button onClick={handleGetBooks}>
                GET BOOKS
              </button>
            </div>

            <div className='text-base-content my-4'>
              <div className='mb-4 grid grid-cols-2 gap-4 sm:grid-cols-3'>
                <div className='overflow-hidden'>
                  <ul className="list-disc pl-5">
                    {books.map((book) => (
                      <li
                        key={book}
                        className="cursor-pointer hover:bg-base-200 rounded px-2 py-1"
                        onClick={() => handleBookSelect(book)}
                      >
                        {book}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Dialog>
    </div>
  );
};

export default KavitaImportModal;
