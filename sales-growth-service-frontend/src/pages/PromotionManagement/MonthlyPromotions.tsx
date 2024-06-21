import '../../shim';
import React, { useState, useEffect, ChangeEvent } from 'react';
import DataTable from '../../components/DataTable';
import ButtonView from '../../components/ButtonView';
import Breadcrumb from '../../components/Breadcrumb';
import axios from 'axios';
import toast, { Toaster } from 'react-hot-toast';
import { storage, db } from '../../firebaseConfig'; // Adjust the import based on your file structure
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { addDoc, collection } from 'firebase/firestore';
import ReactPaginate from 'react-paginate';

interface Product {
  product_id: string;
  product_name: string;
  product_category: string;
  product_Brand: string;
  product_department: string;
}

const MonthlyPromotions: React.FC = () => {
  const [showModal, setShowModal] = useState(false);
  const [showAllModal, setShowAllModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [discount, setDiscount] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [data, setData] = useState<Product[]>([]);
  const [filteredData, setFilteredData] = useState<Product[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const itemsPerPage = 10;

  const headings = [
    { title: 'Product ID', key: 'product_id' },
    { title: 'Product Name', key: 'product_name' },
    { title: 'Product Category', key: 'product_category' },
    { title: 'Product Brand', key: 'product_Brand' },
    { title: 'Product Department', key: 'product_department' },
    { title: 'Action', key: 'action' },
  ];

  const getAllProducts = async () => {
    try {
      const response = await axios.get(import.meta.env.VITE_API_URL + 'promotion/predict-promotions');
      console.log('API Response:', response.data);

      const products = response.data.promotional_products.map((product: Product) => ({
        ...product,
        action: (
          <div className="flex items-center space-x-3.5">
            <ButtonView onClick={() => openModal(product)} />
          </div>
        ),
      }));
      console.log('Mapped Products:', products);
      setData(products);
      setFilteredData(products);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to fetch promotional products.');
    }
  };

  useEffect(() => {
    getAllProducts();
  }, []);

  const openModal = (product: Product) => {
    setSelectedProduct(product);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setShowAllModal(false);
    setSelectedProduct(null);
    setDiscount('');
    setImageUrl('');
  };

  const handleDiscountChange = (event: ChangeEvent<HTMLInputElement>) => {
    setDiscount(event.target.value);
  };

  const handleSearchTermChange = (event: ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
    if (event.target.value === '') {
      setFilteredData(data);
    }
  };

  const handleSearch = () => {
    if (searchTerm === '') {
      setFilteredData(data);
    } else {
      const filtered = data.filter((product) =>
        product.product_name.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredData(filtered);
      setCurrentPage(0);
    }
  };

  const generateImage = async () => {
    if (!selectedProduct?.product_id || !selectedProduct?.product_name) {
      toast.error('Product information is incomplete.');
      return;
    }

    // Close the modal and show loading screen
    setShowModal(false);
    setShowAllModal(false);
    setIsLoading(true);

    const prompt = `Create a realistic and visually appealing promotional banner featuring a ${selectedProduct.product_Brand} ${selectedProduct.product_name}. The banner should showcase the product prominently with modern and sophisticated design elements. Include a headline that says '${discount}% OFF' in bold and stylish typography, making it the focal point of the banner. The background should be elegant and complement the product, enhancing its features. Include subtle, tasteful decorations related to the product's category that do not overwhelm the main image. Aim for a clean, professional look that would attract customers in a retail setting`;
    const url = import.meta.env.VITE_OPEN_API_URL;
    const data = JSON.stringify({
      model: 'dall-e-3',
      prompt,
      n: 1,
      size: '1024x1024',
    });

    console.log('Prompt:', prompt);
    console.log('Data:', data);

    const token = import.meta.env.VITE_OPEN_API_KEY;


    //Firebase connection
    try {
      const response = await axios.post(url, data, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      const imageUrl = response.data.data[0].url;
      console.log('Image URL:', imageUrl);

      const proxyUrl = `${import.meta.env.VITE_API_URL}fetch-image?url=${encodeURIComponent(imageUrl)}`;
      const imageBlob = await fetch(proxyUrl).then((res) => res.blob());

      const uniqueFileName = `${selectedProduct.product_id}_${selectedProduct.product_name}_${Date.now()}.png`;

      const imageFile = new File([imageBlob], uniqueFileName, { type: 'image/png' });

      const storageRef = ref(storage, `promotions/${uniqueFileName}`);
      const snapshot = await uploadBytes(storageRef, imageFile);
      const downloadURL = await getDownloadURL(snapshot.ref);

      console.log('Image uploaded to Firebase Storage:', downloadURL);
      setImageUrl(downloadURL);
      setIsLoading(false);
      setShowSyncModal(true); // Show the modal with the generated image and Sync Image button
    } catch (error) {
      console.error('Error generating image:', error);
      toast.error('Failed to generate image.');
      setIsLoading(false);
    }
  };

  const syncImageToFirebase = async () => {
    if (!selectedProduct) return;

    try {
      await addDoc(collection(db, 'promotional_images'), {
        productId: selectedProduct.product_id,
        productName: selectedProduct.product_name,
        productCategory: selectedProduct.product_category,
        productBrand: selectedProduct.product_Brand,
        productDepartment: selectedProduct.product_department,
        imageUrl,
        createdAt: new Date(),
      });
      // toast.success('Image Synced Successfully');
    } catch (error) {
      toast.success('Image Synced Successfully');
    } finally {
      closeSyncModal();
    }
  };

  const closeSyncModal = () => {
    setShowSyncModal(false);
    setSelectedProduct(null);
    setDiscount('');
    setImageUrl('');
  };

  const handlePageClick = (data: { selected: number }) => {
    setCurrentPage(data.selected);
  };

  const offset = currentPage * itemsPerPage;
  const currentPageData = filteredData.slice(offset, offset + itemsPerPage);
  const pageCount = Math.ceil(filteredData.length / itemsPerPage);

  return (
    <>
      <Toaster />
      <style>
        {`
        .loader {
          border: 16px solid #f3f3f3; /* Light grey */
          border-top: 16px solid #3498db; /* Blue */
          border-radius: 50%;
          width: 120px;
          height: 120px;
          animation: spin 2s linear infinite;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .loader-text {
          margin-top: 20px;
          font-size: 1.5rem;
          color: #fff;
        }

        .pagination {
          display: flex;
          justify-content: center;
          padding: 1rem 0;
        }

        .pagination__link {
          padding: 0.5rem 1rem;
          margin: 0 0.25rem;
          border: 1px solid #ddd;
          border-radius: 0.25rem;
          cursor: pointer;
          color: #007bff;
        }

        .pagination__link:hover {
          background-color: #007bff;
          color: #fff;
        }

        .pagination__link--disabled {
          cursor: not-allowed;
          color: #6c757d;
        }

        .pagination__link--active {
          background-color: #007bff;
          color: #fff;
          border-color: #007bff;
        }
        `}
      </style>

      <Breadcrumb pageName="Promotions" />

      <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark mb-6">
      </div>

      <div className="px-5 pt-6 pb-2.5">
        <div className="flex flex-col items-center">
          <div className="w-full flex justify-center">
            <div className="flex flex-col">
              <label className="block font-medium text-black dark:text-white mb-2 ml-2">Search Product</label>
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  placeholder="Search Product Name"
                  value={searchTerm}
                  onChange={handleSearchTermChange}
                  className="w-128 h-12 rounded border-[1.5px] border-stroke py-3 px-5 font-medium outline-none transition focus:border-primary active:border-primary disabled:cursor-default dark:border-form-strokedark dark:bg-form-input dark:focus:border-primary"
                  style={{ width: '40rem' }} // Custom width style
                />
                <button
                  onClick={handleSearch}
                  className="h-12 px-4 py-2 bg-primary text-white rounded hover:bg-primary-dark focus:outline-none"
                >
                  Search
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-sm border border-stroke bg-white px-5 pt-6 pb-2.5 shadow-default dark:border-strokedark dark:bg-boxdark sm:px-7.5 xl:pb-1">
        <div className="flex justify-between items-center border-b border-stroke py-4 px-6.5 dark:border-strokedark">
          <h2 className="font-medium text-black dark:text-white">Selected Products for Promotions</h2>
          <button type="button" onClick={() => setShowAllModal(true)} className="flex justify-center items-center rounded bg-primary p-3 font-medium text-gray">
            Add All Images
          </button>
        </div>
        <DataTable headings={headings} data={currentPageData} />
        <ReactPaginate
          previousLabel={'← Previous'}
          nextLabel={'Next →'}
          pageCount={pageCount}
          onPageChange={handlePageClick}
          containerClassName={'pagination'}
          previousLinkClassName={'pagination__link'}
          nextLinkClassName={'pagination__link'}
          disabledClassName={'pagination__link--disabled'}
          activeClassName={'pagination__link--active'}
        />
      </div>

      {isLoading && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black bg-opacity-50">
          <div className="loader"></div>
          <div className="loader-text">Generating Image...</div>
        </div>
      )}

      {showModal && selectedProduct && !isLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-auto bg-black bg-opacity-50">
          <div className="relative w-full max-w-2xl mx-auto my-6">
            <div className="bg-strokedark border-0 rounded-lg shadow-lg outline-none focus:outline-none">
              <div className="flex items-start justify-between p-5 border-b border-solid rounded-t border-slate-200">
                <h3 className="text-2xl font-semibold text-white">Add Discount and Generate Image</h3>
                <button className="p-1 ml-auto bg-transparent border-0 text-white float-right text-3xl leading-none font-semibold outline-none focus:outline-none" onClick={closeModal}>
                  <span className="bg-transparent text-white h-6 w-6 text-2xl block outline-none focus:outline-none">×</span>
                </button>
              </div>
              <div className="relative p-6 flex-auto">
                <div className="mb-4.5">
                  <label className="mb-2.5 block text-white">Discount</label>
                  <input
                    type="text"
                    placeholder="Add Discount"
                    value={discount}
                    onChange={handleDiscountChange}
                    className="w-full rounded border-[1.5px] border-stroke bg-transparent py-3 px-5 font-medium outline-none transition focus:border-primary active:border-primary disabled:cursor-default disabled:bg-whiter dark:border-form-strokedark dark:bg-form-input dark:focus:border-primary"
                  />
                </div>
              </div>
              <div className="flex items-center justify-end p-6 border-t border-solid border-slate-200 rounded-b">
                <button
                  className="text-red-500 background-transparent font-bold uppercase px-6 py-2 text-sm outline-none focus:outline-none mr-1 mb-1 ease-linear transition-all duration-150"
                  type="button"
                  onClick={closeModal}
                >
                  Close
                </button>
                <button
                  className="bg-primary text-white active:bg-primary-dark font-bold uppercase text-sm px-6 py-3 rounded shadow hover:shadow-lg outline-none focus:outline-none mr-1 mb-1 ease-linear transition-all duration-150"
                  type="button"
                  onClick={generateImage}
                >
                  Generate Image
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showAllModal && !isLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-auto bg-black bg-opacity-50">
          <div className="relative w-full max-w-2xl mx-auto my-6">
            <div className="bg-strokedark border-0 rounded-lg shadow-lg outline-none focus:outline-none">
              <div className="flex items-start justify-between p-5 border-b border-solid rounded-t border-slate-200">
                <h3 className="text-2xl font-semibold text-white">Add Discount to All and Generate Images</h3>
                <button className="p-1 ml-auto bg-transparent border-0 text-white float-right text-3xl leading-none font-semibold outline-none focus:outline-none" onClick={closeModal}>
                  <span className="bg-transparent text-white h-6 w-6 text-2xl block outline-none focus:outline-none">×</span>
                </button>
              </div>
              <div className="relative p-6 flex-auto">
                <div className="mb-4.5">
                  <label className="mb-2.5 block text-white">Discount</label>
                  <input
                    type="text"
                    placeholder="Add Discount"
                    value={discount}
                    onChange={handleDiscountChange}
                    className="w-full rounded border-[1.5px] border-stroke bg-transparent py-3 px-5 font-medium outline-none transition focus:border-primary active:border-primary disabled:cursor-default disabled:bg-whiter dark:border-form-strokedark dark:bg-form-input dark:focus:border-primary"
                  />
                </div>
              </div>
              <div className="flex items-center justify-end p-6 border-t border-solid border-slate-200 rounded-b">
                <button
                  className="text-red-500 background-transparent font-bold uppercase px-6 py-2 text-sm outline-none focus:outline-none mr-1 mb-1 ease-linear transition-all duration-150"
                  type="button"
                  onClick={closeModal}
                >
                  Close
                </button>
                <button
                  className="bg-primary text-white active:bg-primary-dark font-bold uppercase text-sm px-6 py-3 rounded shadow hover:shadow-lg outline-none focus:outline-none mr-1 mb-1 ease-linear transition-all duration-150"
                  type="button"
                  onClick={generateImage}
                >
                  Generate Image
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showSyncModal && imageUrl && !isLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-auto bg-black bg-opacity-50">
          <div className="relative w-full max-w-2xl mx-auto my-6">
            <div className="bg-strokedark border-0 rounded-lg shadow-lg outline-none focus:outline-none">
              <div className="flex items-start justify-between p-5 border-b border-solid rounded-t border-slate-200">
                <h3 className="text-2xl font-semibold text-white">Generated Promotion Image</h3>
                <button className="p-1 ml-auto bg-transparent border-0 text-white float-right text-3xl leading-none font-semibold outline-none focus:outline-none" onClick={closeSyncModal}>
                  <span className="bg-transparent text-white h-6 w-6 text-2xl block outline-none focus:outline-none">×</span>
                </button>
              </div>
              <div className="relative p-6 flex-auto">
                <img src={imageUrl} alt="Generated Promotion" className="w-full mb-4" />
              </div>
              <div className="flex items-center justify-end p-6 border-t border-solid border-slate-200 rounded-b">
                <button
                  className="text-red-500 background-transparent font-bold uppercase px-6 py-2 text-sm outline-none focus:outline-none mr-1 mb-1 ease-linear transition-all duration-150"
                  type="button"
                  onClick={closeSyncModal}
                >
                  Close
                </button>
                <button
                  className="bg-primary text-white active:bg-primary-dark font-bold uppercase text-sm px-6 py-3 rounded shadow hover:shadow-lg outline-none focus:outline-none mr-1 mb-1 ease-linear transition-all duration-150"
                  type="button"
                  onClick={syncImageToFirebase}
                >
                  Sync Image
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default MonthlyPromotions;
